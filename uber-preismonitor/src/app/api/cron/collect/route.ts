/**
 * Cron-Endpunkt: führt EINE Scheduler-Runde aus (alle fälligen Strecken).
 * Für Hosting ohne Dauer-Prozess (Vercel). Aufruf jede Minute durch
 *  - Vercel Cron (Pro-Tarif, vercel.json) – sendet automatisch "Authorization: Bearer $CRON_SECRET"
 *  - oder einen externen Dienst (z. B. cron-job.org) mit demselben Header.
 */
import { HttpError, handler, json } from "@/lib/api";
import { collectRoute } from "@/lib/collector";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { describeActiveProvider, getActiveProvider } from "@/lib/providers";
import { SlidingWindowLimiter } from "@/lib/rate-limiter";
import { claimDueRoutes, remainingBudget, writeHeartbeat } from "@/lib/scheduler";
import { safeEqual } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROUTES_PER_RUN = 10;

async function run(req: Request) {
  const secret = env.cronSecret;
  if (!secret || secret.length < 16) throw new HttpError(503, "CRON_SECRET ist nicht gesetzt (mind. 16 Zeichen)");
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !safeEqual(auth.slice(7), secret)) throw new HttpError(401, "Nicht berechtigt");

  const started = new Date();
  const provider = getActiveProvider();
  const info = describeActiveProvider();
  const budget = await remainingBudget();
  const routes = await claimDueRoutes(Math.min(budget, MAX_ROUTES_PER_RUN), 300);

  // Kurze Wiederholungen, damit die Runde innerhalb des Zeitlimits bleibt
  const limiter = new SlidingWindowLimiter(env.providerMaxPerMinute, env.providerMaxPerHour);
  const outcomes = await Promise.all(
    routes.map((r) =>
      collectRoute(r, provider, limiter, { retries: Math.min(env.workerMaxRetries, 2), maxDelayMs: 8_000, limiterWaitMs: 5_000 }).catch((err) => {
        logger.error({ err: (err as Error).message, routeId: r.id }, "Cron-Job fehlgeschlagen");
        return { status: "FAILED" as const, saved: 0, error: (err as Error).message };
      }),
    ),
  );
  const summary = {
    mode: "cron",
    lastLoopAt: new Date().toISOString(),
    routes: routes.length,
    saved: outcomes.reduce((a, o) => a + o.saved, 0),
    success: outcomes.filter((o) => o.status === "SUCCESS").length,
    failed: outcomes.filter((o) => o.status === "FAILED").length,
    noData: outcomes.filter((o) => o.status === "NO_DATA").length,
    budget,
    durationMs: Date.now() - started.getTime(),
    lastError: outcomes.find((o) => o.error)?.error ?? null,
    runs: routes.length,
    running: 0,
    limiter: { lastMinute: 0, lastHour: 0, pausedUntil: null },
  };
  await writeHeartbeat(started, info.id, { ...summary, provider: info });
  return json(summary);
}

export const GET = handler(run);
export const POST = handler(run);
