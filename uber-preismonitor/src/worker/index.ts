/**
 * Background-Worker: läuft unabhängig vom Browser rund um die Uhr.
 * - Scheduler: holt fällige Strecken aus der DB (FOR UPDATE SKIP LOCKED,
 *   dadurch auch mit mehreren Worker-Instanzen sicher)
 * - Rate-Limiting pro Datenquelle, Retry mit exponentiellem Backoff
 * - Heartbeat für die Statusanzeige im Dashboard
 */
import { collectRoute } from "../lib/collector";
import { prisma } from "../lib/db";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { describeActiveProvider, getActiveProvider } from "../lib/providers";
import { SlidingWindowLimiter } from "../lib/rate-limiter";
import { claimDueRoutes, writeHeartbeat } from "../lib/scheduler";

const LEASE_SECONDS = 600;
const limiter = new SlidingWindowLimiter(env.providerMaxPerMinute, env.providerMaxPerHour);
const startedAt = new Date();
let stopping = false;
let wake: (() => void) | null = null;
function sleepUnlessStopping(ms: number) {
  return new Promise<void>((r) => {
    const t = setTimeout(r, ms);
    wake = () => { clearTimeout(t); r(); };
  });
}
let running = 0;
const stats = { runs: 0, success: 0, failed: 0, noData: 0, lastLoopAt: null as string | null, lastError: null as string | null };

async function heartbeat() {
  const p = describeActiveProvider();
  await writeHeartbeat(startedAt, p.id, { mode: "worker", ...stats, running, limiter: limiter.stats(), provider: p, pid: process.pid });
}

async function loop() {
  const provider = getActiveProvider();
  const free = env.workerConcurrency - running;
  if (free <= 0) return;
  const routes = await claimDueRoutes(free, LEASE_SECONDS);
  for (const route of routes) {
    running++;
    collectRoute(route, provider, limiter)
      .then((o) => {
        stats.runs++;
        if (o.status === "SUCCESS") stats.success++;
        else if (o.status === "NO_DATA") stats.noData++;
        else if (o.status === "FAILED") {
          stats.failed++;
          stats.lastError = o.error ?? null;
        }
      })
      .catch(async (err) => {
        stats.failed++;
        stats.lastError = (err as Error).message;
        logger.error({ err: (err as Error).message, routeId: route.id }, "Unerwarteter Fehler im Job");
        // Lease freigeben, damit die Strecke nicht hängen bleibt
        await prisma.route
          .update({ where: { id: route.id }, data: { nextRunAt: new Date(Date.now() + 60_000) } })
          .catch(() => {});
      })
      .finally(() => {
        running--;
      });
  }
}

async function main() {
  const p = describeActiveProvider();
  logger.info({ provider: p.id, configured: p.configured, reason: p.reason, isDemo: p.isDemo }, "Worker gestartet");
  if (p.isDemo) logger.warn("ACHTUNG: DEMO-Datenquelle aktiv – es werden SIMULIERTE Preise gespeichert (isDemo=true).");
  if (!p.configured) logger.warn({ reason: p.reason }, "Keine nutzbare Datenquelle – Preise bleiben 'Nicht verfügbar'.");

  await heartbeat().catch((e) => logger.error({ err: e.message }, "Heartbeat fehlgeschlagen"));
  const hb = setInterval(() => heartbeat().catch((e) => logger.error({ err: e.message }, "Heartbeat fehlgeschlagen")), 30_000);

  while (!stopping) {
    try {
      await loop();
      stats.lastLoopAt = new Date().toISOString();
    } catch (err) {
      logger.error({ err: (err as Error).message }, "Scheduler-Fehler – neuer Versuch im nächsten Takt");
    }
    // kurzer Takt, damit 1-Minuten-Intervalle pünktlich laufen
    await sleepUnlessStopping(Math.min(env.workerPollSeconds, 60) * 1000);
  }

  clearInterval(hb);
  const deadline = Date.now() + 30_000;
  while (running > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
  await prisma.$disconnect();
  logger.info("Worker beendet");
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    logger.info({ sig }, "Beende Worker …");
    stopping = true;
    wake?.();
  });
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, "Worker abgestürzt");
  process.exit(1);
});
