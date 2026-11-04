import { SUPPORTED_INTERVALS } from "./env";

/** Effektives Intervall: gewähltes Intervall, aber nie kürzer als die Quelle erlaubt. */
export function effectiveInterval(routeInterval: number, providerMinInterval: number): number {
  const valid = (SUPPORTED_INTERVALS as readonly number[]).includes(routeInterval) ? routeInterval : 5;
  return Math.max(valid, Math.max(1, providerMinInterval));
}

/** Nach Fehlschlägen wird das Intervall schrittweise verlängert (max. 60 Min.). */
export function intervalAfterFailures(intervalMin: number, consecutiveFails: number): number {
  if (consecutiveFails <= 0) return intervalMin;
  const factor = 2 ** Math.min(consecutiveFails - 1, 6);
  return Math.max(intervalMin, Math.min(60, intervalMin * factor));
}

/** Nächster Lauf auf volle Minute ausgerichtet (gleichmäßige Zeitachsen). */
export function nextRunAt(from: Date, intervalMin: number): Date {
  const ms = intervalMin * 60_000;
  const next = Math.floor(from.getTime() / 60_000) * 60_000 + ms;
  return new Date(next);
}
