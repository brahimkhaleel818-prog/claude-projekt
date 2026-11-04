/**
 * Adresssuche über OpenStreetMap Nominatim.
 * Nutzungsrichtlinie: max. 1 Anfrage/Sekunde, identifizierender User-Agent,
 * Ergebnisse cachen, keine Autovervollständigung pro Tastendruck.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
import { prisma } from "./db";
import { HttpError } from "./api";
import { env } from "./env";

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
  type: string;
}

let lastCall = 0;
let queue: Promise<unknown> = Promise.resolve();

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

export async function geocode(q: string): Promise<GeoResult[]> {
  const key = q.toLowerCase();
  const cached = await prisma.geocodeCache.findUnique({ where: { query: key } });
  if (cached && Date.now() - cached.createdAt.getTime() < 30 * 86_400_000) return cached.result as unknown as GeoResult[];

  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    addressdetails: "0",
    limit: "6",
    countrycodes: "de",
    "accept-language": "de",
    // Düsseldorf & Umgebung bevorzugen
    viewbox: "6.55,51.40,7.05,51.10",
  });
  if (env.nominatimContact.includes("@")) params.set("email", env.nominatimContact);
  const res = await throttle(() =>
    fetch(`${env.nominatimUrl}/search?${params}`, {
      headers: { "user-agent": "UberPreismonitor-Duesseldorf/1.0 (self-hosted)", accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    }),
  );
  if (!res.ok)
    throw new HttpError(
      502,
      res.status === 429 ? "Adresssuche ist gerade ausgelastet – bitte in einer Minute erneut versuchen" : `Adresssuche fehlgeschlagen (HTTP ${res.status})`,
    );
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string; type: string }>;
  const results = data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon), type: d.type }));
  await prisma.geocodeCache.upsert({ where: { query: key }, create: { query: key, result: results }, update: { result: results, createdAt: new Date() } });
  return results;
}
