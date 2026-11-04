/**
 * Uber Riders API v1.2 – GET /v1.2/estimates/price
 * Laut Uber-Doku: "Access to this API endpoint requires approval from Uber."
 * Auth: Server-Token (Authorization: Token <SERVER_TOKEN>).
 * Doku: https://developer.uber.com/docs/riders/references/api/v1.2/estimates-price-get
 */
import { env } from "../env";
import { errorFromResponse, providerFetch } from "./http";
import {
  type GeoPoint,
  type PriceProvider,
  type ProductPrice,
  type ProviderResult,
  ProviderError,
  normalizeCategory,
} from "./types";

interface RidersPriceResponse {
  prices?: Array<{
    product_id?: string;
    display_name?: string;
    localized_display_name?: string;
    estimate?: string;
    low_estimate?: number | null;
    high_estimate?: number | null;
    currency_code?: string | null;
    surge_multiplier?: number | null;
    duration?: number | null;
    distance?: number | null; // Meilen
  }>;
}

export function parseRidersPrices(json: RidersPriceResponse, httpStatus = 200): ProviderResult {
  const products: ProductPrice[] = [];
  for (const p of json.prices ?? []) {
    const name = p.localized_display_name || p.display_name;
    if (!name) continue;
    const low = typeof p.low_estimate === "number" ? p.low_estimate : null;
    const high = typeof p.high_estimate === "number" ? p.high_estimate : low;
    products.push({
      priceType: "RANGE",
      productId: p.product_id ?? null,
      category: name,
      categoryKey: normalizeCategory(p.display_name || name),
      value: low !== null && high !== null ? Math.round(((low + high) / 2) * 100) / 100 : null,
      low,
      high,
      display: p.estimate ?? null,
      currency: p.currency_code ?? null,
      surgeMultiplier: typeof p.surge_multiplier === "number" ? p.surge_multiplier : null,
      distanceKm: typeof p.distance === "number" ? Math.round(p.distance * 1.609344 * 100) / 100 : null,
      durationSec: typeof p.duration === "number" ? p.duration : null,
      pickupEtaMin: null,
    });
  }
  return { products, faresUnavailable: false, httpStatus };
}

export class UberRidersV12Provider implements PriceProvider {
  id = "uber-riders-v12";
  label = "Uber Riders API v1.2 (Preisschätzung)";
  isLive = true;
  isDemo = false;
  description =
    "Klassische Uber-Preisschätzung (Preisspanne inkl. Surge-Faktor). Nur mit ausdrücklicher Freigabe durch Uber nutzbar.";
  knownCategories = ["UberX", "Comfort", "UberXL", "Green", "Black", "Taxi"];

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  status() {
    if (!env.uberServerToken) return { configured: false, reason: "UBER_SERVER_TOKEN fehlt" };
    return { configured: true };
  }

  async fetchPrices(origin: GeoPoint, dest: GeoPoint, signal?: AbortSignal): Promise<ProviderResult> {
    if (!this.status().configured) throw new ProviderError("Uber Riders API nicht konfiguriert", { retryable: false });
    const qs = new URLSearchParams({
      start_latitude: String(origin.lat),
      start_longitude: String(origin.lng),
      end_latitude: String(dest.lat),
      end_longitude: String(dest.lng),
    });
    const res = await providerFetch(
      `${env.uberApiBase}/v1.2/estimates/price?${qs}`,
      {
        headers: { authorization: `Token ${env.uberServerToken}`, "accept-language": env.uberAcceptLanguage },
        signal,
      },
      this.fetchImpl,
    );
    if (!res.ok) throw await errorFromResponse(res, "Uber Riders v1.2 estimates/price");
    return parseRidersPrices((await res.json()) as RidersPriceResponse, res.status);
  }
}
