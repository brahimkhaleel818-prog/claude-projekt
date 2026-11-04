import { prisma } from "./db";
import { evaluateRule, ruleMatches } from "./alerts";
import { logger } from "./logger";
import { deliver } from "./notify";
import { categoryLabel } from "./providers/types";

interface SavedMeasurement {
  id: string;
  routeId: string;
  categoryKey: string;
  category: string;
  priceValue: number;
  fetchedAt: Date;
  localDate: string;
  isDemo: boolean;
}

/** Prüft alle aktiven Alarmregeln gegen frisch gespeicherte Messungen. */
export async function processAlerts(routeName: string, measurements: SavedMeasurement[]) {
  if (measurements.length === 0) return 0;
  const rules = await prisma.alertRule.findMany({ where: { active: true } });
  if (rules.length === 0) return 0;
  let fired = 0;

  for (const m of measurements) {
    const matching = rules.filter((r) => ruleMatches(r, m.routeId, m.categoryKey));
    if (matching.length === 0) continue;

    const base = { routeId: m.routeId, categoryKey: m.categoryKey, isDemo: m.isDemo, fetchedAt: { lt: m.fetchedAt } };
    const [prev, day] = await Promise.all([
      prisma.priceMeasurement.findFirst({ where: base, orderBy: { fetchedAt: "desc" }, select: { priceValue: true } }),
      prisma.priceMeasurement.aggregate({
        where: { ...base, localDate: m.localDate },
        _max: { priceValue: true },
        _min: { priceValue: true },
      }),
    ]);
    const ctx = {
      current: m.priceValue,
      previous: prev ? Number(prev.priceValue) : null,
      dayMaxBefore: day._max.priceValue !== null ? Number(day._max.priceValue) : null,
      dayMinBefore: day._min.priceValue !== null ? Number(day._min.priceValue) : null,
    };
    const label = `${routeName} · ${categoryLabel(m.categoryKey, m.category)}${m.isDemo ? " · DEMO" : ""}`;

    for (const rule of matching) {
      const hit = evaluateRule(rule, ctx, label);
      if (!hit) continue;
      // Cooldown je Regel + Strecke + Kategorie
      const recent = await prisma.notification.findFirst({
        where: {
          alertRuleId: rule.id,
          routeId: m.routeId,
          categoryKey: m.categoryKey,
          createdAt: { gte: new Date(Date.now() - rule.cooldownMinutes * 60_000) },
        },
        select: { id: true },
      });
      if (recent) continue;
      const n = await prisma.notification.create({
        data: {
          alertRuleId: rule.id,
          routeId: m.routeId,
          categoryKey: m.categoryKey,
          level: hit.level,
          title: hit.title,
          message: hit.message,
          isDemo: m.isDemo,
        },
      });
      await prisma.alertRule.update({ where: { id: rule.id }, data: { lastTriggeredAt: new Date() } });
      fired++;
      deliver(n.id, rule.channels, hit.title, hit.message).catch((err) =>
        logger.warn({ err: (err as Error).message }, "Zustellung fehlgeschlagen"),
      );
    }
  }
  return fired;
}
