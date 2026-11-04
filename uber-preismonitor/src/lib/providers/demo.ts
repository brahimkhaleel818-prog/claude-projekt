/**
 * DEMO-DATENQUELLE – erzeugt SIMULIERTE Preise für Entwicklung und Tests.
 * Diese Werte sind KEINE Uber-Preise. Alle Messungen werden mit isDemo=true
 * gespeichert und in der Oberfläche deutlich als "DEMO" gekennzeichnet.
 * Live-Ansichten blenden Demo-Daten aus, sobald eine echte Quelle aktiv ist.
 */
import { berlinParts } from "../time";
import { type GeoPoint, type PriceProvider, type ProviderResult, haversineKm, normalizeCategory } from "./types";

const CATS = [
  { name: "UberX", base: 4.5, perKm: 1.55, min: 9 },
  { name: "Comfort", base: 5.5, perKm: 1.9, min: 11 },
  { name: "UberXL", base: 7, perKm: 2.4, min: 14 },
  { name: "Black", base: 10, perKm: 3.1, min: 22 },
];

/** Nachfragekurve über den Tag (Simulation) */
function demandFactor(hour: number, weekday: number): number {
  const rush = Math.exp(-((hour - 7.5) ** 2) / 2) * 0.35 + Math.exp(-((hour - 17.5) ** 2) / 3) * 0.3;
  const night = hour >= 22 || hour < 2 ? (weekday >= 4 ? 0.25 : 0.1) : 0;
  return 1 + rush + night;
}

export class DemoProvider implements PriceProvider {
  id = "demo";
  label = "DEMO – simulierte Daten";
  isLive = false;
  isDemo = true;
  description = "Simulierte Werte für Entwicklung und Tests. Keine echten Uber-Preise!";
  knownCategories = CATS.map((c) => c.name);

  constructor(private readonly rnd: () => number = Math.random) {}

  status() {
    return { configured: true };
  }

  async fetchPrices(origin: GeoPoint, dest: GeoPoint, _signal?: AbortSignal, now = new Date()): Promise<ProviderResult> {
    const km = haversineKm(origin, dest) * 1.3;
    const { localHour, weekday } = berlinParts(now);
    const factor = demandFactor(localHour, weekday) * (0.93 + this.rnd() * 0.14);
    return {
      faresUnavailable: false,
      httpStatus: 200,
      products: CATS.map((c) => {
        const v = Math.max(c.min, (c.base + c.perKm * km) * factor);
        const low = Math.floor(v);
        const high = Math.ceil(v * 1.12);
        return {
          priceType: "DEMO" as const,
          productId: `demo-${c.name.toLowerCase()}`,
          category: c.name,
          categoryKey: normalizeCategory(c.name),
          value: Math.round(((low + high) / 2) * 100) / 100,
          low,
          high,
          display: `DEMO €${low}–${high}`,
          currency: "EUR",
          surgeMultiplier: Math.round(factor * 100) / 100,
          distanceKm: Math.round(km * 10) / 10,
          durationSec: Math.round((km / 35) * 3600),
          pickupEtaMin: 2 + Math.floor(this.rnd() * 6),
        };
      }),
    };
  }
}
