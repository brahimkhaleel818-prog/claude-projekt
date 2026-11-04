/** Reine Statistik-Funktionen (ohne DB) – testbar. */

export interface Point {
  t: number; // ms
  v: number;
}

export function summary(values: number[]) {
  if (values.length === 0) return { count: 0, min: null, max: null, avg: null, median: null, std: null };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: round2(avg),
    median: round2(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2),
    std: round2(Math.sqrt(variance)),
  };
}

export function round2(v: number) {
  return Math.round(v * 100) / 100;
}

/** Preisänderung absolut und prozentual */
export function change(current: number | null, previous: number | null) {
  if (current === null || previous === null) return { abs: null, pct: null };
  return { abs: round2(current - previous), pct: previous > 0 ? round2(((current - previous) / previous) * 100) : null };
}

/**
 * Auffällige Preisspitzen: Messwert liegt mehr als `z` Standardabweichungen
 * über dem Mittelwert des Zeitraums (mind. 10 Messwerte nötig).
 */
export function detectPeaks(points: Point[], z = 2): Set<number> {
  const peaks = new Set<number>();
  if (points.length < 10) return peaks;
  const s = summary(points.map((p) => p.v));
  if (!s.std || s.std === 0 || s.avg === null) return peaks;
  for (const p of points) if ((p.v - s.avg) / s.std > z) peaks.add(p.t);
  return peaks;
}

export type Cell = { avg: number | null; min: number | null; max: number | null; count: number };

export function emptyCell(): Cell {
  return { avg: null, min: null, max: null, count: 0 };
}
