import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/guest-estimates.json";
import { DemoProvider } from "@/lib/providers/demo";
import { ProviderError, normalizeCategory } from "@/lib/providers/types";
import { UberGuestRidesProvider, parseGuestEstimates } from "@/lib/providers/uber-guest-rides";
import { UberRidersV12Provider, parseRidersPrices } from "@/lib/providers/uber-riders-v12";

const HBF = { lat: 51.21992, lng: 6.7943 };
const DUS = { lat: 51.2785, lng: 6.7648 };

describe("parseGuestEstimates", () => {
  it("liest Upfront-Festpreise und Spannen, überspringt Stundenpakete", () => {
    const r = parseGuestEstimates(fixture as never);
    expect(r.faresUnavailable).toBe(false);
    expect(r.products.map((p) => p.category)).toEqual(["UberX", "Comfort"]);
    const x = r.products[0];
    expect(x).toMatchObject({ priceType: "UPFRONT", value: 11.96, low: 11.96, high: 11.96, display: "$11.96", currency: "USD", pickupEtaMin: 4, durationSec: 927, categoryKey: "uberx" });
    expect(x.distanceKm).toBeCloseTo(0.71, 2);
    expect(r.products[1]).toMatchObject({ priceType: "RANGE", low: 13, high: 16, value: 14.5, categoryKey: "comfort" });
  });

  it("fares_unavailable → keine Preise, keine erfundenen Werte", () => {
    const r = parseGuestEstimates({ fares_unavailable: true, product_estimates: [{ product: { display_name: "UberX" }, estimate_info: { fare: null } }] });
    expect(r.faresUnavailable).toBe(true);
    expect(r.products[0].value).toBeNull();
  });
});

describe("parseRidersPrices", () => {
  it("liest Preisspannen inkl. Surge; Taxameter ohne Preis bleibt null", () => {
    const r = parseRidersPrices({
      prices: [
        { display_name: "uberX", product_id: "a", estimate: "€23-28", low_estimate: 23, high_estimate: 28, currency_code: "EUR", surge_multiplier: 1.2, duration: 900, distance: 5 },
        { display_name: "TAXI", product_id: "t", estimate: "Metered", low_estimate: null, high_estimate: null, currency_code: null },
      ],
    });
    expect(r.products[0]).toMatchObject({ priceType: "RANGE", value: 25.5, low: 23, high: 28, surgeMultiplier: 1.2, categoryKey: "uberx" });
    expect(r.products[0].distanceKm).toBeCloseTo(8.05, 2);
    expect(r.products[1].value).toBeNull();
  });
});

describe("normalizeCategory", () => {
  it.each([
    ["UberX", "uberx"], ["uberX", "uberx"], ["Comfort", "comfort"], ["Uber Comfort", "comfort"], ["UberXL", "uberxl"], ["XL", "uberxl"],
    ["Black", "black"], ["Black Hourly", "black_hourly"], ["Green", "green"], ["WAV", "wav"], ["Taxi", "taxi"], ["Van", "van"],
  ])("%s → %s", (a, b) => expect(normalizeCategory(a)).toBe(b));
});

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("UberGuestRidesProvider (HTTP gemockt)", () => {
  beforeEach(() => {
    process.env.UBER_CLIENT_ID = "cid";
    process.env.UBER_CLIENT_SECRET = "secret";
    process.env.UBER_ORGANIZATION_UUID = "org-1";
  });
  afterEach(() => {
    delete process.env.UBER_CLIENT_ID;
    delete process.env.UBER_CLIENT_SECRET;
    delete process.env.UBER_ORGANIZATION_UUID;
  });

  it("holt Token per client_credentials und fragt Estimates korrekt ab", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const f = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("oauth")) return res(200, { access_token: "tok", expires_in: 2592000, token_type: "Bearer" });
      return res(200, fixture);
    });
    const p = new UberGuestRidesProvider(f as unknown as typeof fetch);
    const r = await p.fetchPrices(HBF, DUS);
    expect(r.products).toHaveLength(2);
    const tokenBody = String(calls[0].init.body);
    expect(tokenBody).toContain("grant_type=client_credentials");
    expect(tokenBody).toContain("scope=guests.trips");
    expect(calls[1].url).toBe("https://api.uber.com/v1/guests/trips/estimates");
    const h = calls[1].init.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer tok");
    expect(h["x-uber-organizationuuid"]).toBe("org-1");
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ pickup: { latitude: HBF.lat, longitude: HBF.lng }, dropoff: { latitude: DUS.lat, longitude: DUS.lng } });
    // Token wird wiederverwendet
    await p.fetchPrices(HBF, DUS);
    expect(calls.filter((c) => c.url.includes("oauth"))).toHaveLength(1);
  });

  it("erneuert das Token einmal bei 401", async () => {
    let n = 0;
    const f = vi.fn(async (url: string) => {
      if (url.includes("oauth")) return res(200, { access_token: `tok${++n}`, expires_in: 100 });
      return n === 1 ? res(401, { code: "unauthorized" }) : res(200, fixture);
    });
    const r = await new UberGuestRidesProvider(f as unknown as typeof fetch).fetchPrices(HBF, DUS);
    expect(r.products.length).toBe(2);
    expect(n).toBe(2);
  });

  it("403 (keine Freigabe) ist nicht wiederholbar und verständlich", async () => {
    const f = vi.fn(async (url: string) => (url.includes("oauth") ? res(200, { access_token: "t", expires_in: 100 }) : res(403, { code: "forbidden" })));
    const err = await new UberGuestRidesProvider(f as unknown as typeof fetch).fetchPrices(HBF, DUS).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/Freigabe/);
  });

  it("429 ist wiederholbar und übernimmt Retry-After", async () => {
    const f = vi.fn(async (url: string) => (url.includes("oauth") ? res(200, { access_token: "t", expires_in: 100 }) : res(429, "slow down", { "retry-after": "30" })));
    const err = await new UberGuestRidesProvider(f as unknown as typeof fetch).fetchPrices(HBF, DUS).catch((e) => e);
    expect(err.retryable).toBe(true);
    expect(err.retryAfterMs).toBe(30_000);
  });

  it("ohne Zugangsdaten: nicht konfiguriert", () => {
    delete process.env.UBER_CLIENT_ID;
    expect(new UberGuestRidesProvider().status().configured).toBe(false);
  });
});

describe("UberRidersV12Provider", () => {
  it("sendet Server-Token und Koordinaten", async () => {
    process.env.UBER_SERVER_TOKEN = "srv";
    let seen = "";
    let auth = "";
    const f = vi.fn(async (url: string, init: RequestInit) => {
      seen = url;
      auth = (init.headers as Record<string, string>).authorization;
      return res(200, { prices: [] });
    });
    await new UberRidersV12Provider(f as unknown as typeof fetch).fetchPrices(HBF, DUS);
    expect(seen).toContain("/v1.2/estimates/price?start_latitude=51.21992&start_longitude=6.7943&end_latitude=51.2785&end_longitude=6.7648");
    expect(auth).toBe("Token srv");
    delete process.env.UBER_SERVER_TOKEN;
  });
});

describe("DemoProvider", () => {
  it("ist eindeutig als Demo gekennzeichnet", async () => {
    const p = new DemoProvider(() => 0.5);
    expect(p.isDemo).toBe(true);
    expect(p.isLive).toBe(false);
    const r = await p.fetchPrices(HBF, DUS);
    for (const x of r.products) {
      expect(x.priceType).toBe("DEMO");
      expect(x.display).toMatch(/^DEMO/);
    }
  });
});
