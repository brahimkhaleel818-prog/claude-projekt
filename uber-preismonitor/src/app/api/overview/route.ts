import { handler, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { describeActiveProvider } from "@/lib/providers";
import { routesOverview } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const [routes, hb, unread] = await Promise.all([
    routesOverview(),
    prisma.workerHeartbeat.findUnique({ where: { id: "worker" } }),
    prisma.notification.count({ where: { readAt: null } }),
  ]);
  return json({
    provider: describeActiveProvider(),
    worker: hb ? { beatAt: hb.beatAt, startedAt: hb.startedAt, alive: Date.now() - hb.beatAt.getTime() < 120_000, provider: hb.provider } : null,
    unreadNotifications: unread,
    routes,
    serverTime: new Date(),
  });
});
