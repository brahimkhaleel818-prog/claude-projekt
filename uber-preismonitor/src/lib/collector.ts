import type { Route, RunStatus } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./logger";
import { processAlerts } from "./alert-engine";
import type { PriceProvider } from "./providers/types";
import { ProviderError } from "./providers/types";
import type { SlidingWindowLimiter } from "./rate-limiter";
import { withRetry } from "./retry";
import { effectiveInterval, intervalAfterFailures, nextRunAt } from "./schedule";
import { berlinParts } from "./time";

export interface RunOutcome {
  status: RunStatus;
  saved: number;
  error?: string;
}

/**
 * Führt eine Preisabfrage für eine Strecke aus, speichert alle Messwerte
 * und den Lauf (auch Fehlschläge – ohne erfundene Werte), plant den
 * nächsten Lauf und prüft Preisalarme.
 */
export async function collectRoute(
  route: Route,
  provider: PriceProvider | null,
  limiter: SlidingWindowLimiter,
  opts: { retries?: number; maxDelayMs?: number; limiterWaitMs?: number } = {},
): Promise<RunOutcome> {
  const started = new Date();
  const interval = effectiveInterval(route.intervalMinutes, env.providerMinIntervalMinutes);
  const log = logger.child({ routeId: route.id, route: route.name });

  if (!provider || !provider.status().configured) {
    const reason = provider ? provider.status().reason : "Keine Datenquelle konfiguriert (PRICE_PROVIDER)";
    await prisma.route.update({
      where: { id: route.id },
      data: {
        lastRunAt: started,
        lastStatus: "NOT_CONFIGURED",
        lastError: reason ?? null,
        nextRunAt: nextRunAt(started, Math.max(interval, 5)),
      },
    });
    return { status: "NOT_CONFIGURED", saved: 0, error: reason };
  }

  let status: RunStatus = "FAILED";
  let attempts = 1;
  let httpStatus: number | undefined;
  let errorMessage: string | undefined;
  let saved: Awaited<ReturnType<typeof prisma.priceMeasurement.create>>[] = [];
  let productCount = 0;

  try {
    const { value: result, attempts: a } = await withRetry(
      async () => {
        const ok = await limiter.acquire(opts.limiterWaitMs ?? 90_000);
        if (!ok) throw new ProviderError("Rate-Limit der Datenquelle ausgeschöpft – Abfrage übersprungen", { retryable: false });
        try {
          return await provider.fetchPrices(
            { lat: route.originLat, lng: route.originLng, address: route.originAddress },
            { lat: route.destLat, lng: route.destLng, address: route.destAddress },
          );
        } catch (err) {
          if (err instanceof ProviderError && err.httpStatus === 429) limiter.pause(err.retryAfterMs ?? 60_000);
          throw err;
        }
      },
      {
        retries: opts.retries ?? env.workerMaxRetries,
        baseDelayMs: 2000,
        maxDelayMs: opts.maxDelayMs ?? 30_000,
        onRetry: (n, err, d) => log.warn({ attempt: n, delayMs: d, err: (err as Error).message }, "Wiederhole Preisabfrage"),
      },
    );
    attempts = a;
    httpStatus = result.httpStatus;
    const wanted = route.categories.length > 0 ? new Set(route.categories) : null;
    const usable = result.products.filter(
      (p) =>
        p.value !== null &&
        Number.isFinite(p.value) &&
        p.value > 0 &&
        (!wanted || wanted.has(p.categoryKey)) &&
        (!env.onlyUpfrontFares || p.priceType !== "RANGE"),
    );
    productCount = result.products.length;

    if (usable.length === 0) {
      status = "NO_DATA";
      errorMessage = result.faresUnavailable
        ? "Uber meldet: Fahrpreise derzeit nicht verfügbar (fares_unavailable)"
        : env.onlyUpfrontFares && result.products.length > 0
          ? "Nur Preisspannen erhalten – wegen ONLY_UPFRONT_FARES verworfen"
          : "Quelle lieferte keine Preise für die gewählten Kategorien";
    } else {
      status = "SUCCESS";
    }

    const run = await prisma.fetchRun.create({
      data: {
        routeId: route.id,
        provider: provider.id,
        isDemo: provider.isDemo,
        status,
        attempts,
        httpStatus,
        errorMessage,
        productCount,
        startedAt: started,
        finishedAt: new Date(),
        durationMs: Date.now() - started.getTime(),
      },
    });

    if (status === "SUCCESS") {
      const fetchedAt = new Date();
      const parts = berlinParts(fetchedAt);
      saved = await prisma.$transaction(
        usable.map((p) =>
          prisma.priceMeasurement.create({
            data: {
              routeId: route.id,
              runId: run.id,
              provider: provider.id,
              isDemo: provider.isDemo,
              priceType: p.priceType,
              productId: p.productId,
              category: p.category,
              categoryKey: p.categoryKey,
              priceValue: p.value!,
              priceLow: p.low,
              priceHigh: p.high,
              displayText: p.display,
              currency: p.currency ?? "EUR",
              surgeMultiplier: p.surgeMultiplier,
              distanceKm: p.distanceKm,
              durationSec: p.durationSec,
              pickupEtaMin: p.pickupEtaMin,
              originAddress: route.originAddress,
              destAddress: route.destAddress,
              direction: `${route.originAddress} → ${route.destAddress}`,
              fetchedAt,
              ...parts,
              status: "OK",
            },
          }),
        ),
      );
    }
  } catch (err) {
    status = "FAILED";
    errorMessage = (err as Error).message;
    attempts = (err as { attempts?: number }).attempts ?? attempts;
    httpStatus = err instanceof ProviderError ? err.httpStatus : undefined;
    await prisma.fetchRun.create({
      data: {
        routeId: route.id,
        provider: provider.id,
        isDemo: provider.isDemo,
        status,
        attempts,
        httpStatus,
        errorMessage: errorMessage.slice(0, 1000),
        startedAt: started,
        finishedAt: new Date(),
        durationMs: Date.now() - started.getTime(),
      },
    });
    log.error({ err: errorMessage, attempts, httpStatus }, "Preisabfrage fehlgeschlagen");
  }

  const fails = status === "SUCCESS" ? 0 : route.consecutiveFails + 1;
  await prisma.route.update({
    where: { id: route.id },
    data: {
      lastRunAt: started,
      lastStatus: status,
      lastError: errorMessage?.slice(0, 1000) ?? null,
      consecutiveFails: fails,
      ...(status === "SUCCESS" ? { lastSuccessAt: new Date() } : {}),
      nextRunAt: nextRunAt(new Date(), intervalAfterFailures(interval, fails)),
    },
  });

  if (fails === 5) {
    await prisma.notification.create({
      data: {
        routeId: route.id,
        level: "error",
        title: `Abfragen fehlgeschlagen · ${route.name}`,
        message: `5 Abfragen in Folge ohne Preise. Letzter Fehler: ${errorMessage ?? "unbekannt"}`,
        isDemo: provider.isDemo,
      },
    });
  }

  if (saved.length > 0) {
    log.info({ saved: saved.length, attempts }, "Preise gespeichert");
    await processAlerts(
      route.name,
      saved.map((m) => ({ ...m, priceValue: Number(m.priceValue) })),
    ).catch((err) => log.error({ err: (err as Error).message }, "Alarmprüfung fehlgeschlagen"));
  }
  return { status, saved: saved.length, error: errorMessage };
}
