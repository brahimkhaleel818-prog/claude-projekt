/**
 * Modulare Provider-Architektur: Jede autorisierte Preisdatenquelle
 * implementiert dieses Interface. Neue Quellen werden in ./index.ts registriert.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
  address?: string;
}

export type PriceType = "UPFRONT" | "RANGE" | "MANUAL" | "DEMO";

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  UPFRONT: "Upfront-Festpreis (buchbar)",
  RANGE: "Preisspanne (Schätzung von Uber)",
  MANUAL: "Manuell aus der Uber-App",
  DEMO: "DEMO (simuliert)",
};

export interface ProductPrice {
  priceType: PriceType;
  productId: string | null;
  category: string; // Anzeigename laut Quelle
  categoryKey: string; // normalisiert
  /** Festpreis bzw. Mittelwert der Spanne. null = kein Preis (z. B. Taxameter) */
  value: number | null;
  low: number | null;
  high: number | null;
  display: string | null;
  currency: string | null;
  surgeMultiplier: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  pickupEtaMin: number | null;
}

export interface ProviderResult {
  products: ProductPrice[];
  /** Quelle meldet ausdrücklich, dass gerade keine Preise verfügbar sind */
  faresUnavailable: boolean;
  httpStatus: number;
}

export interface ProviderStatus {
  configured: boolean;
  reason?: string;
}

export interface PriceProvider {
  id: string;
  label: string;
  /** true = echte Live-Daten von Uber; false = Demo/Simulation */
  isLive: boolean;
  isDemo: boolean;
  description: string;
  /** Kategorien, die die Quelle grundsätzlich liefern kann (Info für die UI) */
  knownCategories: string[];
  status(): ProviderStatus;
  fetchPrices(origin: GeoPoint, dest: GeoPoint, signal?: AbortSignal): Promise<ProviderResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly opts: { retryable: boolean; httpStatus?: number; retryAfterMs?: number } = { retryable: false },
  ) {
    super(message);
    this.name = "ProviderError";
  }
  get retryable() { return this.opts.retryable; }
  get httpStatus() { return this.opts.httpStatus; }
  get retryAfterMs() { return this.opts.retryAfterMs; }
}

/** Normalisiert Uber-Produktnamen auf stabile Schlüssel für Vergleiche. */
export function normalizeCategory(name: string): string {
  const n = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (n === "uberx" || n === "x") return "uberx";
  if (n === "uberxl" || n === "xl") return "uberxl";
  if (n.includes("comfort")) return "comfort";
  if (n.includes("green")) return "green";
  if (n.includes("black")) return n.includes("hourly") ? "black_hourly" : "black";
  if (n.includes("van")) return "van";
  if (n.includes("wav") || n.includes("assist") || n.includes("access")) return "wav";
  if (n.includes("taxi")) return "taxi";
  if (n.includes("pet")) return "pet";
  if (n.includes("share") || n.includes("pool")) return "share";
  if (n.includes("premier") || n.includes("select")) return "premier";
  return n.replace(/^uber/, "") || n;
}

export const CATEGORY_LABELS: Record<string, string> = {
  uberx: "UberX",
  comfort: "Uber Comfort",
  uberxl: "UberXL",
  green: "Uber Green",
  black: "Uber Black",
  black_hourly: "Uber Black (Stunde)",
  van: "Uber Van",
  wav: "Uber WAV",
  taxi: "Uber Taxi",
  pet: "Uber Pet",
  share: "Uber Share",
  premier: "Uber Premier",
};

export function categoryLabel(key: string, fallback?: string): string {
  return CATEGORY_LABELS[key] ?? fallback ?? key;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
