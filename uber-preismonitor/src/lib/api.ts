import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { logger } from "./logger";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Einheitliche Fehlerbehandlung für API-Routen */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      if (err instanceof ZodError)
        return json({ error: "Ungültige Eingabe", details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
      logger.error({ err: (err as Error).message, stack: (err as Error).stack }, "API-Fehler");
      return json({ error: "Interner Fehler" }, 500);
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Ungültiges JSON");
  }
  return schema.parse(body);
}

/** Einfaches In-Memory-Rate-Limit pro Schlüssel (z. B. IP) */
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, "Zu viele Anfragen – bitte kurz warten");
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) buckets.clear();
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

import { type RangeKey, resolveRange } from "./time";

/** Liest ?range=today|yesterday|7d|30d|custom&from=YYYY-MM-DD&to=YYYY-MM-DD */
export function rangeFromUrl(url: URL) {
  const raw = url.searchParams.get("range") ?? "today";
  const key = (["today", "yesterday", "7d", "30d", "custom"].includes(raw) ? raw : "today") as RangeKey;
  return resolveRange(key, new Date(), url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
}
