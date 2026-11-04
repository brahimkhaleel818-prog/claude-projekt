import { isAlive } from "@/lib/scheduler";
import { handler, json } from "@/lib/api";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { channelStatus } from "@/lib/notify";
import { describeActiveProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const [hb, runs, counts, demoCount] = await Promise.all([
    prisma.workerHeartbeat.findUnique({ where: { id: "worker" } }),
    prisma.fetchRun.findMany({ orderBy: { startedAt: "desc" }, take: 50, include: { route: { select: { name: true } } } }),
    prisma.priceMeasurement.groupBy({ by: ["provider", "priceType", "isDemo"], _count: true }),
    prisma.priceMeasurement.count({ where: { isDemo: true } }),
  ]);
  return json({
    provider: describeActiveProvider(),
    limits: {
      perMinute: env.providerMaxPerMinute,
      perHour: env.providerMaxPerHour,
      minIntervalMinutes: env.providerMinIntervalMinutes,
      onlyUpfrontFares: env.onlyUpfrontFares,
      maxRetries: env.workerMaxRetries,
    },
    worker: hb ? { ...hb, alive: isAlive(hb.beatAt) } : null,
    channels: channelStatus(),
    runs,
    counts,
    demoCount,
  });
});
