/**
 * Gemeinsame Scheduler-Bausteine für den Dauer-Worker (Docker/Server)
 * und den Cron-Endpunkt (Vercel / externer Cron-Dienst).
 */
import type { Route } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";

/** Worker gilt als "läuft", wenn das letzte Lebenszeichen jünger ist (Cron-Modus: 1-Min.-Takt + Puffer). */
export const HEARTBEAT_MAX_AGE_MS = 6 * 60_000;

export function isAlive(beatAt: Date) {
  return Date.now() - beatAt.getTime() < HEARTBEAT_MAX_AGE_MS;
}

/** Fällige Strecken atomar "leasen" (FOR UPDATE SKIP LOCKED) – sicher bei parallelen Workern/Cron-Aufrufen. */
export async function claimDueRoutes(limit: number, leaseSeconds = 600): Promise<Route[]> {
  if (limit <= 0) return [];
  return prisma.$queryRaw<Route[]>`
    UPDATE "Route" SET "nextRunAt" = now() + make_interval(secs => ${leaseSeconds}::float8)
    WHERE id IN (
      SELECT id FROM "Route"
      WHERE active = true AND "nextRunAt" <= now()
      ORDER BY "nextRunAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

/**
 * Rate-Limit über die Datenbank (für Serverless, wo kein Prozess dauerhaft
 * im Speicher bleibt): wie viele Abfragen sind gerade noch erlaubt?
 */
export async function remainingBudget(): Promise<number> {
  const now = Date.now();
  const [lastMinute, lastHour] = await Promise.all([
    prisma.fetchRun.count({ where: { startedAt: { gte: new Date(now - 60_000) } } }),
    prisma.fetchRun.count({ where: { startedAt: { gte: new Date(now - 3_600_000) } } }),
  ]);
  return Math.max(0, Math.min(env.providerMaxPerMinute - lastMinute, env.providerMaxPerHour - lastHour));
}

export async function writeHeartbeat(startedAt: Date, providerId: string, info: unknown) {
  const data = { beatAt: new Date(), startedAt, provider: providerId, info: JSON.parse(JSON.stringify(info ?? {})) };
  await prisma.workerHeartbeat.upsert({ where: { id: "worker" }, create: { id: "worker", ...data }, update: data });
}
