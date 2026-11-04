import type { AlertRule, AlertType } from "@prisma/client";

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  PCT_INCREASE: "Preisanstieg um mehr als X %",
  PCT_DECREASE: "Preisrückgang um mehr als X %",
  ABOVE_AMOUNT: "Preis über X €",
  BELOW_AMOUNT: "Preis unter X €",
  DAILY_HIGH: "Neue Tageshöchstmarke",
  DAILY_LOW: "Neuer Tagestiefstwert",
};

export interface AlertContext {
  current: number;
  previous: number | null; // letzte Messung derselben Strecke/Kategorie
  dayMaxBefore: number | null; // Tageshöchstwert vor dieser Messung
  dayMinBefore: number | null;
}

export interface AlertHit {
  title: string;
  message: string;
  level: "info" | "warning";
}

const eur = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/** Prüft eine Regel gegen eine neue Messung. Reine Funktion (testbar). */
export function evaluateRule(
  rule: Pick<AlertRule, "type" | "threshold" | "name">,
  ctx: AlertContext,
  label: string,
): AlertHit | null {
  const { current, previous } = ctx;
  switch (rule.type) {
    case "PCT_INCREASE":
    case "PCT_DECREASE": {
      if (previous === null || previous <= 0) return null;
      const pct = ((current - previous) / previous) * 100;
      if (rule.type === "PCT_INCREASE" && pct > rule.threshold)
        return {
          level: "warning",
          title: `▲ +${pct.toFixed(1)} % · ${label}`,
          message: `Preis gestiegen von ${eur(previous)} auf ${eur(current)} (+${eur(current - previous)}). Regel: ${rule.name}`,
        };
      if (rule.type === "PCT_DECREASE" && -pct > rule.threshold)
        return {
          level: "info",
          title: `▼ ${pct.toFixed(1)} % · ${label}`,
          message: `Preis gesunken von ${eur(previous)} auf ${eur(current)} (${eur(current - previous)}). Regel: ${rule.name}`,
        };
      return null;
    }
    case "ABOVE_AMOUNT":
      if (current > rule.threshold && (previous === null || previous <= rule.threshold))
        return { level: "warning", title: `Über ${eur(rule.threshold)} · ${label}`, message: `Aktueller Preis ${eur(current)}. Regel: ${rule.name}` };
      return null;
    case "BELOW_AMOUNT":
      if (current < rule.threshold && (previous === null || previous >= rule.threshold))
        return { level: "info", title: `Unter ${eur(rule.threshold)} · ${label}`, message: `Aktueller Preis ${eur(current)}. Regel: ${rule.name}` };
      return null;
    case "DAILY_HIGH":
      if (ctx.dayMaxBefore !== null && current > ctx.dayMaxBefore)
        return {
          level: "warning",
          title: `Neues Tageshoch · ${label}`,
          message: `${eur(current)} (bisheriges Tageshoch ${eur(ctx.dayMaxBefore)}). Regel: ${rule.name}`,
        };
      return null;
    case "DAILY_LOW":
      if (ctx.dayMinBefore !== null && current < ctx.dayMinBefore)
        return {
          level: "info",
          title: `Neues Tagestief · ${label}`,
          message: `${eur(current)} (bisheriges Tagestief ${eur(ctx.dayMinBefore)}). Regel: ${rule.name}`,
        };
      return null;
  }
}

export function ruleMatches(rule: Pick<AlertRule, "routeId" | "categoryKey" | "active">, routeId: string, categoryKey: string) {
  return rule.active && (!rule.routeId || rule.routeId === routeId) && (!rule.categoryKey || rule.categoryKey === categoryKey);
}
