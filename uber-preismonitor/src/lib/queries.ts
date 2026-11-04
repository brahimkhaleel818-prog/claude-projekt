import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { showDemoData } from "./providers";
import { categoryLabel } from "./providers/types";
import { effectiveInterval } from "./schedule";
import { type Cell, change, detectPeaks, emptyCell, round2 } from "./stats";

/** Demo- und echte Daten werden NIE vermischt. */
export function dataFilter() {
  return { isDemo: showDemoData() };
}

const num = (d: Prisma.Decimal | number | null | undefined) => (d === null || d === undefined ? null : Number(d));

export async function routesOverview() {
  const routes = await prisma.route.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { reverseOf: { select: { id: true } } } });
  const isDemo = showDemoData();
  const result = [];
  for (const r of routes) {
    // je Kategorie die letzten zwei Messwerte
    const latest = await prisma.$queryRaw<
      Array<{ categoryKey: string; category: string; priceValue: Prisma.Decimal; priceLow: Prisma.Decimal | null; priceHigh: Prisma.Decimal | null; displayText: string | null; currency: string; priceType: string; provider: string; fetchedAt: Date; rn: bigint }>
    >`
      SELECT * FROM (
        SELECT "categoryKey", category, "priceValue", "priceLow", "priceHigh", "displayText", currency, "priceType", provider, "fetchedAt",
               row_number() OVER (PARTITION BY "categoryKey" ORDER BY "fetchedAt" DESC) AS rn
        FROM "PriceMeasurement"
        WHERE "routeId" = ${r.id} AND "isDemo" = ${isDemo}
      ) x WHERE rn <= 2 ORDER BY "categoryKey", rn`;
    const byCat = new Map<string, typeof latest>();
    for (const row of latest) byCat.set(row.categoryKey, [...(byCat.get(row.categoryKey) ?? []), row]);
    const interval = effectiveInterval(r.intervalMinutes, env.providerMinIntervalMinutes);
    const staleAfterMs = Math.max(interval * 3, 10) * 60_000;
    const categories = [...byCat.entries()].map(([key, rows]) => {
      const last = rows[0];
      const prev = rows[1] ?? null;
      const lastV = num(last.priceValue)!;
      const fresh = Date.now() - last.fetchedAt.getTime() < staleAfterMs && r.lastStatus === "SUCCESS";
      return {
        categoryKey: key,
        category: categoryLabel(key, last.category),
        current: fresh ? lastV : null, // nur "aktuell", wenn die letzte Abfrage erfolgreich & frisch war
        last: lastV,
        lastLow: num(last.priceLow),
        lastHigh: num(last.priceHigh),
        lastDisplay: last.displayText,
        lastAt: last.fetchedAt,
        priceType: last.priceType,
        provider: last.provider,
        currency: last.currency,
        previous: prev ? num(prev.priceValue) : null,
        previousAt: prev?.fetchedAt ?? null,
        change: change(lastV, prev ? num(prev.priceValue) : null),
      };
    });
    result.push({
      id: r.id,
      name: r.name,
      originAddress: r.originAddress,
      destAddress: r.destAddress,
      originLat: r.originLat,
      originLng: r.originLng,
      destLat: r.destLat,
      destLng: r.destLng,
      active: r.active,
      intervalMinutes: r.intervalMinutes,
      effectiveIntervalMinutes: interval,
      categories: r.categories,
      reverseRouteId: r.reverseRouteId ?? r.reverseOf?.id ?? null,
      lastRunAt: r.lastRunAt,
      lastSuccessAt: r.lastSuccessAt,
      lastStatus: r.lastStatus,
      lastError: r.lastError,
      consecutiveFails: r.consecutiveFails,
      nextRunAt: r.nextRunAt,
      prices: categories,
    });
  }
  return result;
}

export async function availableCategories(routeId?: string) {
  const rows = await prisma.priceMeasurement.groupBy({
    by: ["categoryKey"],
    where: { ...dataFilter(), ...(routeId ? { routeId } : {}) },
    _count: true,
    _max: { category: true },
  });
  return rows
    .map((r) => ({ key: r.categoryKey, label: categoryLabel(r.categoryKey, r._max.category ?? undefined), count: r._count }))
    .sort((a, b) => b.count - a.count);
}

function bucketMinutesFor(from: Date, to: Date): number {
  const hours = (to.getTime() - from.getTime()) / 3_600_000;
  if (hours <= 50) return 0; // Rohdaten
  if (hours <= 24 * 8) return 15;
  if (hours <= 24 * 35) return 60;
  return 180;
}

/**
 * Zeitreihe für Charts. Fehlgeschlagene Abfragen werden als Lücke (null)
 * eingefügt – es wird NIE ein Wert erfunden oder interpoliert.
 */
export async function series(routeId: string, from: Date, to: Date, categoryKeys: string[]) {
  const isDemo = showDemoData();
  const bucket = bucketMinutesFor(from, to);
  type Row = { t: Date; categoryKey: string; v: number; lo: number | null; hi: number | null; n: number };
  const cats = categoryKeys.length > 0 ? categoryKeys : null;
  const catFilter = cats ? Prisma.sql`AND "categoryKey" IN (${Prisma.join(cats)})` : Prisma.empty;
  const rows: Row[] =
    bucket === 0
      ? await prisma.$queryRaw<Row[]>`
          SELECT "fetchedAt" AS t, "categoryKey", "priceValue"::float AS v, "priceLow"::float AS lo, "priceHigh"::float AS hi, 1 AS n
          FROM "PriceMeasurement"
          WHERE "routeId" = ${routeId} AND "isDemo" = ${isDemo} AND "fetchedAt" >= ${from} AND "fetchedAt" < ${to} ${catFilter}
          ORDER BY "fetchedAt"`
      : await prisma.$queryRaw<Row[]>`
          SELECT date_bin(make_interval(mins => ${bucket}::int), "fetchedAt", TIMESTAMPTZ '2000-01-01') AS t, "categoryKey",
                 avg("priceValue")::float AS v, min("priceValue")::float AS lo, max("priceValue")::float AS hi, count(*)::int AS n
          FROM "PriceMeasurement"
          WHERE "routeId" = ${routeId} AND "isDemo" = ${isDemo} AND "fetchedAt" >= ${from} AND "fetchedAt" < ${to} ${catFilter}
          GROUP BY 1, 2 ORDER BY 1`;

  const failedRuns = await prisma.fetchRun.findMany({
    where: { routeId, isDemo, status: { in: ["FAILED", "NO_DATA"] }, startedAt: { gte: from, lt: to } },
    select: { startedAt: true, status: true, errorMessage: true },
    orderBy: { startedAt: "asc" },
  });

  // Zusammenführen: eine Zeile je Zeitpunkt, Spalten je Kategorie
  const map = new Map<number, Record<string, number | null | string>>();
  for (const r of rows) {
    const t = new Date(r.t).getTime();
    const e = map.get(t) ?? { t };
    e[r.categoryKey] = round2(Number(r.v));
    e[`${r.categoryKey}__lo`] = r.lo !== null ? round2(Number(r.lo)) : null;
    e[`${r.categoryKey}__hi`] = r.hi !== null ? round2(Number(r.hi)) : null;
    map.set(t, e);
  }
  const gapBucketMs = Math.max(bucket, 1) * 60_000;
  for (const f of failedRuns) {
    const t = Math.floor(f.startedAt.getTime() / gapBucketMs) * gapBucketMs;
    if (bucket === 0) {
      if (!map.has(f.startedAt.getTime())) map.set(f.startedAt.getTime(), { t: f.startedAt.getTime(), __gap: f.status });
    } else if (!map.has(t)) map.set(t, { t, __gap: f.status });
  }
  const points = [...map.values()].sort((a, b) => (a.t as number) - (b.t as number));

  // Spitzen je Kategorie markieren
  const keys = [...new Set(rows.map((r) => r.categoryKey))];
  for (const k of keys) {
    const pts = points.filter((p) => typeof p[k] === "number").map((p) => ({ t: p.t as number, v: p[k] as number }));
    const peaks = detectPeaks(pts);
    for (const p of points) if (peaks.has(p.t as number)) p[`${k}__peak`] = p[k];
  }
  return { bucketMinutes: bucket, categories: keys, points, failedRuns: failedRuns.length };
}

export async function routeStats(routeId: string | null, from: Date, to: Date, categoryKey: string | null) {
  const isDemo = showDemoData();
  const routeF = routeId ? Prisma.sql`AND "routeId" = ${routeId}` : Prisma.empty;
  const catF = categoryKey ? Prisma.sql`AND "categoryKey" = ${categoryKey}` : Prisma.empty;
  const where = Prisma.sql`"isDemo" = ${isDemo} AND "fetchedAt" >= ${from} AND "fetchedAt" < ${to} ${routeF} ${catF}`;

  const [sumRow] = await prisma.$queryRaw<Array<{ n: number; min: number | null; max: number | null; avg: number | null; std: number | null }>>`
    SELECT count(*)::int AS n, min("priceValue")::float AS min, max("priceValue")::float AS max,
           avg("priceValue")::float AS avg, stddev_pop("priceValue")::float AS std
    FROM "PriceMeasurement" WHERE ${where}`;
  const [maxRow] = await prisma.$queryRaw<Array<{ fetchedAt: Date; v: number }>>`
    SELECT "fetchedAt", "priceValue"::float AS v FROM "PriceMeasurement" WHERE ${where} ORDER BY "priceValue" DESC, "fetchedAt" DESC LIMIT 1`;
  const [minRow] = await prisma.$queryRaw<Array<{ fetchedAt: Date; v: number }>>`
    SELECT "fetchedAt", "priceValue"::float AS v FROM "PriceMeasurement" WHERE ${where} ORDER BY "priceValue" ASC, "fetchedAt" DESC LIMIT 1`;

  const grid = await prisma.$queryRaw<Array<{ weekday: number; hour: number; avg: number; min: number; max: number; n: number }>>`
    SELECT weekday, "localHour" AS hour, avg("priceValue")::float AS avg, min("priceValue")::float AS min,
           max("priceValue")::float AS max, count(*)::int AS n
    FROM "PriceMeasurement" WHERE ${where} GROUP BY 1, 2`;
  const daily = await prisma.$queryRaw<Array<{ day: string; hour: number; avg: number; n: number }>>`
    SELECT "localDate" AS day, "localHour" AS hour, avg("priceValue")::float AS avg, count(*)::int AS n
    FROM "PriceMeasurement" WHERE ${where} GROUP BY 1, 2 ORDER BY 1, 2`;

  const heatmap: Cell[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, emptyCell));
  const byHourAcc = Array.from({ length: 24 }, () => ({ sum: 0, n: 0, min: Infinity, max: -Infinity }));
  const byDayAcc = Array.from({ length: 7 }, () => ({ sum: 0, n: 0, min: Infinity, max: -Infinity }));
  for (const g of grid) {
    heatmap[g.weekday][g.hour] = { avg: round2(g.avg), min: round2(g.min), max: round2(g.max), count: g.n };
    for (const [acc, idx] of [[byHourAcc, g.hour], [byDayAcc, g.weekday]] as const) {
      acc[idx].sum += g.avg * g.n;
      acc[idx].n += g.n;
      acc[idx].min = Math.min(acc[idx].min, g.min);
      acc[idx].max = Math.max(acc[idx].max, g.max);
    }
  }
  const finish = (a: { sum: number; n: number; min: number; max: number }) =>
    a.n ? { avg: round2(a.sum / a.n), min: round2(a.min), max: round2(a.max), count: a.n } : emptyCell();

  // Tagesvergleich: je Tag eine Linie über die Stunden
  const days = [...new Set(daily.map((d) => d.day))];
  const dayCompare = Array.from({ length: 24 }, (_, hour) => {
    const row: Record<string, number | null> = { hour };
    for (const d of days) row[d] = null;
    return row;
  });
  for (const d of daily) dayCompare[d.hour][d.day] = round2(d.avg);

  return {
    summary: {
      count: sumRow?.n ?? 0,
      min: sumRow?.min !== null && sumRow?.min !== undefined ? round2(sumRow.min) : null,
      max: sumRow?.max !== null && sumRow?.max !== undefined ? round2(sumRow.max) : null,
      avg: sumRow?.avg !== null && sumRow?.avg !== undefined ? round2(sumRow.avg) : null,
      std: sumRow?.std !== null && sumRow?.std !== undefined ? round2(sumRow.std) : null,
      maxAt: maxRow?.fetchedAt ?? null,
      minAt: minRow?.fetchedAt ?? null,
    },
    byHour: byHourAcc.map((a, hour) => ({ hour, ...finish(a) })),
    byWeekday: byDayAcc.map((a, weekday) => ({ weekday, ...finish(a) })),
    heatmap,
    days,
    dayCompare,
  };
}

export async function runStats(routeId: string | null, from: Date, to: Date) {
  const rows = await prisma.fetchRun.groupBy({
    by: ["status"],
    where: { ...(routeId ? { routeId } : {}), isDemo: showDemoData(), startedAt: { gte: from, lt: to } },
    _count: true,
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count])) as Record<string, number>;
}
