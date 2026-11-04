import { handler, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { describeActiveProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** Leichtgewichtige Daten für Kopfzeile: Quelle, Worker, neue Benachrichtigungen */
export const GET = handler(async (req: Request) => {
  const since = new URL(req.url).searchParams.get("since");
  const [hb, unread, fresh] = await Promise.all([
    prisma.workerHeartbeat.findUnique({ where: { id: "worker" } }),
    prisma.notification.count({ where: { readAt: null } }),
    since
      ? prisma.notification.findMany({ where: { createdAt: { gt: new Date(since) } }, orderBy: { createdAt: "asc" }, take: 10 })
      : Promise.resolve([]),
  ]);
  const p = describeActiveProvider();
  return json({
    provider: { id: p.id, label: p.label, isLive: p.isLive, isDemo: p.isDemo, configured: p.configured, reason: p.reason },
    worker: hb ? { alive: Date.now() - hb.beatAt.getTime() < 120_000, beatAt: hb.beatAt } : null,
    unread,
    fresh,
    serverTime: new Date().toISOString(),
  });
});
