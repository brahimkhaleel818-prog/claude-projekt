import { prisma } from "./db";
import { routeStats } from "./queries";
import { showDemoData } from "./providers";
import { categoryLabel } from "./providers/types";
import { WEEKDAYS_DE, berlinParts } from "./time";
import { round2 } from "./stats";

/**
 * Intelligente Preisanalyse auf Basis GEMESSENER Werte.
 * Ergebnisse sind als "measured" (Messwerte), "estimate" (statistische
 * Auswertung) oder "forecast" (Prognose aus Mustern) gekennzeichnet.
 */
export async function buildInsights(from: Date, to: Date, categoryKey: string | null) {
  const isDemo = showDemoData();
  const routes = await prisma.route.findMany({ select: { id: true, name: true, reverseRouteId: true } });
  const cat = categoryKey ?? (await mostCommonCategory(isDemo));
  const global = await routeStats(null, from, to, cat);

  const perRoute = [];
  for (const r of routes) {
    const s = await routeStats(r.id, from, to, cat);
    perRoute.push({ id: r.id, name: r.name, reverseRouteId: r.reverseRouteId, ...s.summary, byHour: s.byHour, byWeekday: s.byWeekday });
  }

  const insights: Array<{ kind: "measured" | "estimate" | "forecast"; title: string; text: string }> = [];
  const total = global.summary.count;
  const MIN = 20;

  if (total === 0) {
    return { category: cat, categoryLabel: cat ? categoryLabel(cat) : null, total, insights, global, perRoute, forecast: [], enoughData: false };
  }

  const hours = global.byHour.filter((h) => h.count >= 3 && h.avg !== null);
  if (hours.length >= 3) {
    const sorted = [...hours].sort((a, b) => b.avg! - a.avg!);
    const top = sorted.slice(0, 3).map((h) => `${String(h.hour).padStart(2, "0")}:00 (Ø ${fmt(h.avg!)})`);
    const low = sorted.slice(-3).reverse().map((h) => `${String(h.hour).padStart(2, "0")}:00 (Ø ${fmt(h.avg!)})`);
    insights.push({ kind: "estimate", title: "Teuerste Uhrzeiten", text: top.join(", ") });
    insights.push({ kind: "estimate", title: "Günstigste Uhrzeiten", text: low.join(", ") });

    // Wann steigen die Preise normalerweise? Größter Anstieg zwischen aufeinanderfolgenden Stunden
    let best: { hour: number; diff: number } | null = null;
    for (let h = 1; h < 24; h++) {
      const a = global.byHour[h - 1], b = global.byHour[h];
      if (a.avg !== null && b.avg !== null && a.count >= 3 && b.count >= 3) {
        const diff = b.avg - a.avg;
        if (!best || diff > best.diff) best = { hour: h, diff };
      }
    }
    if (best && best.diff > 0)
      insights.push({
        kind: "estimate",
        title: "Typischer Preisanstieg",
        text: `Der stärkste durchschnittliche Anstieg liegt zwischen ${pad(best.hour - 1)}:00 und ${pad(best.hour)}:00 Uhr (+${fmt(best.diff)}).`,
      });

    const avgOf = (from: number, toH: number) => {
      const xs = global.byHour.filter((h) => h.hour >= from && h.hour < toH && h.avg !== null);
      const n = xs.reduce((a, h) => a + h.count, 0);
      return n ? xs.reduce((a, h) => a + h.avg! * h.count, 0) / n : null;
    };
    const morning = avgOf(5, 11), evening = avgOf(16, 22);
    if (morning !== null && evening !== null)
      insights.push({
        kind: "estimate",
        title: "Morgens vs. abends",
        text: `Morgens (05–11 Uhr) Ø ${fmt(morning)}, abends (16–22 Uhr) Ø ${fmt(evening)} – abends ${evening >= morning ? "teurer" : "günstiger"} um ${fmt(Math.abs(evening - morning))} (${pct(evening, morning)}).`,
      });
  }

  const days = global.byWeekday.filter((d) => d.count >= 3 && d.avg !== null);
  if (days.length >= 2) {
    const sorted = [...days].sort((a, b) => b.avg! - a.avg!);
    insights.push({
      kind: "estimate",
      title: "Wochentage",
      text: `Am teuersten: ${WEEKDAYS_DE[sorted[0].weekday]} (Ø ${fmt(sorted[0].avg!)}), am günstigsten: ${WEEKDAYS_DE[sorted[sorted.length - 1].weekday]} (Ø ${fmt(sorted[sorted.length - 1].avg!)}).`,
    });
  }

  // Richtungsvergleich für verknüpfte Strecken
  for (const r of perRoute) {
    if (!r.reverseRouteId) continue;
    const rev = perRoute.find((x) => x.id === r.reverseRouteId);
    if (!rev || r.avg === null || rev.avg === null || r.count < 10 || rev.count < 10) continue;
    if (Math.abs(r.avg - rev.avg) < 0.25) {
      insights.push({ kind: "estimate", title: "Welche Richtung ist teurer?", text: `${r.name} und ${rev.name} kosten im Schnitt praktisch gleich viel (Ø ${fmt(r.avg)} vs. ${fmt(rev.avg)}).` });
      continue;
    }
    const pricier = r.avg >= rev.avg ? r : rev;
    const cheaper = pricier === r ? rev : r;
    insights.push({
      kind: "estimate",
      title: "Welche Richtung ist teurer?",
      text: `${pricier.name} ist im Schnitt ${fmt(pricier.avg! - cheaper.avg!)} teurer als ${cheaper.name} (Ø ${fmt(pricier.avg!)} vs. ${fmt(cheaper.avg!)}).`,
    });
  }

  insights.unshift({
    kind: "measured",
    title: "Datengrundlage",
    text: `${total} gemessene Preise im Zeitraum. Höchster Wert ${fmt(global.summary.max!)}, niedrigster ${fmt(global.summary.min!)}, Durchschnitt ${fmt(global.summary.avg!)}.${total < MIN ? " Achtung: noch wenige Messungen – Muster sind wenig belastbar." : ""}`,
  });

  // Prognose für die nächsten 6 Stunden aus den Wochentag/Stunde-Mittelwerten
  // der letzten 8 Wochen (reine Statistik, keine Garantie).
  const forecast = await buildForecast(isDemo, cat);

  return { category: cat, categoryLabel: cat ? categoryLabel(cat) : null, total, insights, global, perRoute, forecast, enoughData: total >= MIN };
}

async function buildForecast(isDemo: boolean, cat: string | null) {
  const since = new Date(Date.now() - 56 * 86_400_000);
  const rows = await prisma.priceMeasurement.groupBy({
    by: ["weekday", "localHour"],
    where: { isDemo, fetchedAt: { gte: since }, ...(cat ? { categoryKey: cat } : {}) },
    _avg: { priceValue: true },
    _count: true,
  });
  const out = [];
  for (let i = 1; i <= 6; i++) {
    const t = new Date(Date.now() + i * 3_600_000);
    const p = berlinParts(t);
    const r = rows.find((x) => x.weekday === p.weekday && x.localHour === p.localHour);
    out.push({
      at: t,
      label: `${WEEKDAYS_DE[p.weekday].slice(0, 2)} ${pad(p.localHour)}:00`,
      expected: r && r._count >= 3 && r._avg.priceValue !== null ? round2(Number(r._avg.priceValue)) : null,
      basedOn: r?._count ?? 0,
    });
  }
  return out;
}

async function mostCommonCategory(isDemo: boolean) {
  const r = await prisma.priceMeasurement.groupBy({ by: ["categoryKey"], where: { isDemo }, _count: true, orderBy: { _count: { categoryKey: "desc" } } });
  return r.find((x) => x.categoryKey === "uberx")?.categoryKey ?? r[0]?.categoryKey ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const pct = (a: number, b: number) =>
  b > 0 ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : "–";
