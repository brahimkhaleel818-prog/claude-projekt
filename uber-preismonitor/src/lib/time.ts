/** Zeitzonen-Helfer: Alle Anzeigen und Auswertungen in Europe/Berlin. */
export const TZ = "Europe/Berlin";

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
export const WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const WEEKDAYS_DE_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export interface BerlinParts {
  localDate: string; // YYYY-MM-DD
  localTime: string; // HH:mm:ss
  localHour: number;
  weekday: number; // 0 = Montag
}

export function berlinParts(date: Date): BerlinParts {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(date)) p[part.type] = part.value;
  return {
    localDate: `${p.year}-${p.month}-${p.day}`,
    localTime: `${p.hour}:${p.minute}:${p.second}`,
    localHour: Number(p.hour),
    weekday: WEEKDAY_INDEX[p.weekday] ?? 0,
  };
}

/** Offset (in Minuten) von Europe/Berlin gegenüber UTC zu einem Zeitpunkt. */
function berlinOffsetMinutes(date: Date): number {
  const p = berlinParts(date);
  const [y, m, d] = p.localDate.split("-").map(Number);
  const [hh, mm, ss] = p.localTime.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Wandelt "YYYY-MM-DD" + Uhrzeit (Berlin) in einen UTC-Zeitpunkt. */
export function berlinToUtc(localDate: string, time = "00:00:00"): Date {
  const [y, m, d] = localDate.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  // zweimal korrigieren, damit Sommer-/Winterzeitwechsel stimmen
  let result = new Date(guess.getTime() - berlinOffsetMinutes(guess) * 60000);
  result = new Date(guess.getTime() - berlinOffsetMinutes(result) * 60000);
  return result;
}

export function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "custom";

/** Liefert [from, to) als UTC-Zeitpunkte für einen Zeitraum in Berlin-Zeit. */
export function resolveRange(
  key: RangeKey,
  now = new Date(),
  customFrom?: string,
  customTo?: string,
): { from: Date; to: Date; label: string } {
  const today = berlinParts(now).localDate;
  switch (key) {
    case "today":
      return { from: berlinToUtc(today), to: berlinToUtc(addDays(today, 1)), label: "Heute" };
    case "yesterday":
      return { from: berlinToUtc(addDays(today, -1)), to: berlinToUtc(today), label: "Gestern" };
    case "7d":
      return { from: berlinToUtc(addDays(today, -6)), to: berlinToUtc(addDays(today, 1)), label: "Letzte 7 Tage" };
    case "30d":
      return { from: berlinToUtc(addDays(today, -29)), to: berlinToUtc(addDays(today, 1)), label: "Letzte 30 Tage" };
    case "custom": {
      const f = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom) ? customFrom : today;
      const t = customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : f;
      return { from: berlinToUtc(f), to: berlinToUtc(addDays(t, 1)), label: `${f} – ${t}` };
    }
  }
}

const dtFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const tFmt = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "–";
  return dtFmt.format(new Date(d));
}
export function formatTime(d: Date | string): string {
  return tFmt.format(new Date(d));
}
