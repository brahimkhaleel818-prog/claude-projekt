/**
 * Uber for Business – Guest Rides API
 *   POST {UBER_API_BASE}/v1/guests/trips/estimates   (Scope: guests.trips)
 *   Token: client_credentials an https://auth.uber.com/oauth/v2/token
 * Doku: https://developer.uber.com/docs/guest-rides/references/api/v1/guest-trips-estimates-post
 *
 * Zugriff erfordert ein Uber-for-Business-Konto und die Freigabe der
 * Guest-Rides-API durch Uber (siehe docs/UBER-API-ZUGANG.md).
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

interface TokenCache {
  token: string;
  expiresAt: number;
}

type Num = number | null | undefined;
interface GuestEstimateResponse {
  fares_unavailable?: boolean;
  etas_unavailable?: boolean;
  product_estimates?: Array<{
    estimate_info?: {
      fare?: { value?: Num; display?: string; currency_code?: string; hourly?: unknown } | null;
      estimate?: { display?: string; low_estimate?: Num; high_estimate?: Num; currency_code?: string } | null;
      pickup_estimate?: Num;
      trip?: { distance_estimate?: Num; distance_unit?: string; duration_estimate?: Num } | null;
    };
    product?: { product_id?: string; display_name?: string };
  }>;
}

const MILE_KM = 1.609344;

export function parseGuestEstimates(json: GuestEstimateResponse, httpStatus = 200): ProviderResult {
  const products: ProductPrice[] = [];
  for (const pe of json.product_estimates ?? []) {
    const name = pe.product?.display_name;
    if (!name) continue;
    const info = pe.estimate_info ?? {};
    // Stundenpakete (z. B. "Black Hourly") sind keine Streckenpreise
    if (info.fare && info.fare.hourly) continue;

    let value: number | null = null;
    let low: number | null = null;
    let high: number | null = null;
    let display: string | null = null;
    let currency: string | null = null;
    let priceType: "UPFRONT" | "RANGE" = "UPFRONT";

    if (info.fare && typeof info.fare.value === "number") {
      value = low = high = info.fare.value;
      display = info.fare.display ?? null;
      currency = info.fare.currency_code ?? null;
    } else if (info.estimate && (typeof info.estimate.low_estimate === "number" || typeof info.estimate.high_estimate === "number")) {
      low = info.estimate.low_estimate ?? info.estimate.high_estimate ?? null;
      high = info.estimate.high_estimate ?? info.estimate.low_estimate ?? null;
      value = low !== null && high !== null ? Math.round(((low + high) / 2) * 100) / 100 : null;
      display = info.estimate.display ?? null;
      currency = info.estimate.currency_code ?? null;
      priceType = low === high ? "UPFRONT" : "RANGE";
    }

    const trip = info.trip ?? null;
    let distanceKm: number | null = null;
    if (trip && typeof trip.distance_estimate === "number") {
      distanceKm = trip.distance_unit === "mile" ? trip.distance_estimate * MILE_KM : trip.distance_estimate;
      distanceKm = Math.round(distanceKm * 100) / 100;
    }

    products.push({
      priceType,
      productId: pe.product?.product_id ?? null,
      category: name,
      categoryKey: normalizeCategory(name),
      value,
      low,
      high,
      display,
      currency,
      surgeMultiplier: null,
      distanceKm,
      durationSec: typeof trip?.duration_estimate === "number" && trip.duration_estimate > 0 ? trip.duration_estimate : null,
      pickupEtaMin: typeof info.pickup_estimate === "number" ? info.pickup_estimate : null,
    });
  }
  return { products, faresUnavailable: Boolean(json.fares_unavailable), httpStatus };
}

export class UberGuestRidesProvider implements PriceProvider {
  id = "uber-guest-rides";
  label = "Uber Guest Rides API (Uber for Business)";
  isLive = true;
  isDemo = false;
  description =
    "Offizielle Uber-for-Business-Schnittstelle. Liefert Upfront-Fahrpreise bzw. Preisspannen je Fahrzeugkategorie.";
  knownCategories = ["UberX", "Comfort", "UberXL", "Green", "Black", "Van", "WAV"];

  private tokenCache: TokenCache | null = null;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  status() {
    if (!env.uberClientId || !env.uberClientSecret)
      return { configured: false, reason: "UBER_CLIENT_ID / UBER_CLIENT_SECRET fehlen" };
    return { configured: true };
  }

  async getToken(force = false): Promise<string> {
    if (!force && this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) return this.tokenCache.token;
    const body = new URLSearchParams({
      client_id: env.uberClientId,
      client_secret: env.uberClientSecret,
      grant_type: "client_credentials",
      scope: env.uberScope,
    });
    const res = await providerFetch(
      env.uberAuthUrl,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
      this.fetchImpl,
    );
    if (!res.ok) {
      const err = await errorFromResponse(res, "Uber OAuth-Token");
      // Ungültige Zugangsdaten nicht endlos wiederholen
      throw new ProviderError(err.message, { ...err.opts, retryable: res.status === 429 || res.status >= 500 });
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new ProviderError("Uber OAuth-Token: Antwort ohne access_token", { retryable: false });
    this.tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return json.access_token;
  }

  async fetchPrices(origin: GeoPoint, dest: GeoPoint, signal?: AbortSignal): Promise<ProviderResult> {
    const st = this.status();
    if (!st.configured) throw new ProviderError(`Uber Guest Rides nicht konfiguriert: ${st.reason}`, { retryable: false });

    const doRequest = async (token: string) => {
      const headers: Record<string, string> = {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "accept-language": env.uberAcceptLanguage,
      };
      if (env.uberOrganizationUuid) headers["x-uber-organizationuuid"] = env.uberOrganizationUuid;
      if (env.uberSandboxRunUuid) headers["x-uber-sandbox-runuuid"] = env.uberSandboxRunUuid;
      return providerFetch(
        `${env.uberApiBase}/v1/guests/trips/estimates`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            pickup: { latitude: origin.lat, longitude: origin.lng },
            dropoff: { latitude: dest.lat, longitude: dest.lng },
          }),
          signal,
        },
        this.fetchImpl,
      );
    };

    let res = await doRequest(await this.getToken());
    if (res.status === 401) {
      // Token evtl. widerrufen/abgelaufen → einmal neu holen
      res = await doRequest(await this.getToken(true));
    }
    if (!res.ok) throw await errorFromResponse(res, "Uber Guest Rides Estimates");
    const json = (await res.json()) as GuestEstimateResponse;
    return parseGuestEstimates(json, res.status);
  }
}
