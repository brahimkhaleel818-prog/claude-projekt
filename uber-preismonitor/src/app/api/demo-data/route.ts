import { handler, json } from "@/lib/api";
import { prisma } from "@/lib/db";

/** Löscht alle simulierten Demo-Daten (Messwerte, Läufe, Benachrichtigungen). */
export const DELETE = handler(async () => {
  const [m, r, n] = await prisma.$transaction([
    prisma.priceMeasurement.deleteMany({ where: { isDemo: true } }),
    prisma.fetchRun.deleteMany({ where: { isDemo: true } }),
    prisma.notification.deleteMany({ where: { isDemo: true } }),
  ]);
  return json({ measurements: m.count, runs: r.count, notifications: n.count });
});
