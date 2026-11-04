import { describe, expect, it, vi } from "vitest";
import { evaluateRule, ruleMatches } from "@/lib/alerts";
import { toCsv } from "@/lib/export";
import { ProviderError } from "@/lib/providers/types";
import { SlidingWindowLimiter } from "@/lib/rate-limiter";
import { backoffDelay, withRetry } from "@/lib/retry";
import { effectiveInterval, intervalAfterFailures, nextRunAt } from "@/lib/schedule";
import { change, detectPeaks, summary } from "@/lib/stats";
import { berlinParts, berlinToUtc, resolveRange } from "@/lib/time";

describe("Zeitzone Europe/Berlin", () => {
  it("Winterzeit (UTC+1) und Sommerzeit (UTC+2)", () => {
    expect(berlinParts(new Date("2026-01-15T05:00:00Z"))).toMatchObject({ localDate: "2026-01-15", localTime: "06:00:00", localHour: 6, weekday: 3 });
    expect(berlinParts(new Date("2026-07-15T04:00:00Z"))).toMatchObject({ localTime: "06:00:00", localHour: 6 });
  });
  it("berlinToUtc rund um die Zeitumstellung", () => {
    expect(berlinToUtc("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(berlinToUtc("2026-03-30").toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(berlinToUtc("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(berlinToUtc("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
  it("Zeiträume Heute/Gestern/7 Tage", () => {
    const now = new Date("2026-11-04T20:00:00Z"); // 21:00 Berlin
    expect(resolveRange("today", now).from.toISOString()).toBe("2026-11-03T23:00:00.000Z");
    expect(resolveRange("yesterday", now).to.toISOString()).toBe("2026-11-03T23:00:00.000Z");
    const w = resolveRange("7d", now);
    expect((w.to.getTime() - w.from.getTime()) / 86_400_000).toBe(7);
    const c = resolveRange("custom", now, "2026-10-01", "2026-10-02");
    expect(c.from.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(c.to.toISOString()).toBe("2026-10-02T22:00:00.000Z");
  });
});

describe("Preisalarme", () => {
  const base = { name: "R", threshold: 20 };
  it("Anstieg > 20 %", () => {
    expect(evaluateRule({ ...base, type: "PCT_INCREASE" }, { current: 30, previous: 24, dayMaxBefore: null, dayMinBefore: null }, "X")).toMatchObject({ level: "warning" });
    expect(evaluateRule({ ...base, type: "PCT_INCREASE" }, { current: 28, previous: 24, dayMaxBefore: null, dayMinBefore: null }, "X")).toBeNull();
  });
  it("Starker Rückgang", () => {
    expect(evaluateRule({ ...base, type: "PCT_DECREASE" }, { current: 18, previous: 24, dayMaxBefore: null, dayMinBefore: null }, "X")).not.toBeNull();
  });
  it("Eurobetrag überschritten – nur beim Überschreiten, nicht dauerhaft", () => {
    const r = { ...base, type: "ABOVE_AMOUNT" as const, threshold: 40 };
    expect(evaluateRule(r, { current: 41, previous: 39, dayMaxBefore: null, dayMinBefore: null }, "X")).not.toBeNull();
    expect(evaluateRule(r, { current: 42, previous: 41, dayMaxBefore: null, dayMinBefore: null }, "X")).toBeNull();
  });
  it("Neue Tageshöchstmarke (nicht bei erster Messung des Tages)", () => {
    const r = { ...base, type: "DAILY_HIGH" as const };
    expect(evaluateRule(r, { current: 50, previous: 40, dayMaxBefore: 45, dayMinBefore: 30 }, "X")).not.toBeNull();
    expect(evaluateRule(r, { current: 50, previous: null, dayMaxBefore: null, dayMinBefore: null }, "X")).toBeNull();
  });
  it("Filter nach Strecke/Kategorie", () => {
    expect(ruleMatches({ active: true, routeId: null, categoryKey: "uberx" }, "r1", "uberx")).toBe(true);
    expect(ruleMatches({ active: true, routeId: "r2", categoryKey: null }, "r1", "uberx")).toBe(false);
    expect(ruleMatches({ active: false, routeId: null, categoryKey: null }, "r1", "uberx")).toBe(false);
  });
});

describe("Statistik", () => {
  it("summary/change", () => {
    expect(summary([10, 20, 30])).toMatchObject({ count: 3, min: 10, max: 30, avg: 20, median: 20 });
    expect(summary([])).toMatchObject({ count: 0, avg: null });
    expect(change(30, 25)).toEqual({ abs: 5, pct: 20 });
    expect(change(null, 25)).toEqual({ abs: null, pct: null });
  });
  it("erkennt Preisspitzen erst ab 10 Werten", () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ t: i, v: 25 + (i % 2) }));
    pts[10].v = 60;
    expect([...detectPeaks(pts)]).toEqual([10]);
    expect(detectPeaks(pts.slice(0, 5)).size).toBe(0);
  });
});

describe("Scheduler, Retry, Rate-Limit", () => {
  it("Intervall nie kürzer als von der Quelle erlaubt", () => {
    expect(effectiveInterval(1, 5)).toBe(5);
    expect(effectiveInterval(15, 5)).toBe(15);
    expect(effectiveInterval(7, 1)).toBe(5); // ungültig → Standard
  });
  it("Backoff nach Fehlschlägen, max. 60 Min.", () => {
    expect(intervalAfterFailures(5, 0)).toBe(5);
    expect(intervalAfterFailures(5, 2)).toBe(10);
    expect(intervalAfterFailures(5, 10)).toBe(60);
    expect(intervalAfterFailures(60, 3)).toBe(60);
  });
  it("nächster Lauf auf volle Minute", () => {
    expect(nextRunAt(new Date("2026-11-04T10:00:42Z"), 5).toISOString()).toBe("2026-11-04T10:05:00.000Z");
  });
  it("withRetry wiederholt nur wiederholbare Fehler", async () => {
    const sleep = vi.fn(async () => {});
    let n = 0;
    const r = await withRetry(async () => { if (++n < 3) throw new ProviderError("x", { retryable: true }); return "ok"; }, { retries: 3, sleep });
    expect(r).toEqual({ value: "ok", attempts: 3 });
    let m = 0;
    await expect(withRetry(async () => { m++; throw new ProviderError("403", { retryable: false }); }, { retries: 3, sleep })).rejects.toThrow("403");
    expect(m).toBe(1);
  });
  it("Backoff wächst exponentiell", () => {
    expect(backoffDelay(1, 1000, 30000, 0.5)).toBe(1000);
    expect(backoffDelay(3, 1000, 30000, 0.5)).toBe(4000);
    expect(backoffDelay(10, 1000, 30000, 0.5)).toBe(30000);
  });
  it("Rate-Limiter: pro Minute begrenzt, 429-Pause", () => {
    let t = 0;
    const l = new SlidingWindowLimiter(2, 100, () => t);
    expect(l.tryAcquire()).toBe(true);
    expect(l.tryAcquire()).toBe(true);
    expect(l.tryAcquire()).toBe(false);
    t = 60_001;
    expect(l.tryAcquire()).toBe(true);
    l.pause(10_000);
    t += 5_000;
    expect(l.tryAcquire()).toBe(false);
  });
});

describe("CSV-Export", () => {
  it("Semikolon, Dezimalkomma, Escaping und Schutz vor Formel-Injection", () => {
    const csv = toCsv([["2026-11-04", "06:00:00", "Mi", "Hbf → DUS", 'A; "B"', "=HYPERLINK()", null, null, null, 23.5]]);
    expect(csv.startsWith("﻿Datum;")).toBe(true);
    const line = csv.split("\r\n")[1];
    expect(line).toContain('"A; ""B"""');
    expect(line).toContain("'=HYPERLINK()");
    expect(line).toContain("23,5");
  });
});

import { normalizeDatabaseUrl } from "@/lib/db";

describe("Datenbank-URL (Vercel/Neon/Supabase)", () => {
  it("ergänzt pgbouncer=true bei Poolern, lässt direkte Verbindungen unverändert", () => {
    expect(normalizeDatabaseUrl("postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db?sslmode=require")).toContain("pgbouncer=true");
    expect(normalizeDatabaseUrl("postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres")).toContain("pgbouncer=true");
    expect(normalizeDatabaseUrl("postgresql://u:p@localhost:5432/db")).toBe("postgresql://u:p@localhost:5432/db");
    expect(normalizeDatabaseUrl('"postgresql://u:p@localhost:5432/db"')).toBe("postgresql://u:p@localhost:5432/db");
  });
});
