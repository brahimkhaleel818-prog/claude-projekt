export interface PriceInfo {
  categoryKey: string;
  category: string;
  current: number | null;
  last: number;
  lastLow: number | null;
  lastHigh: number | null;
  lastDisplay: string | null;
  lastAt: string;
  priceType: string;
  provider: string;
  currency: string;
  previous: number | null;
  previousAt: string | null;
  change: { abs: number | null; pct: number | null };
}

export interface RouteOverview {
  id: string;
  name: string;
  originAddress: string;
  destAddress: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  active: boolean;
  intervalMinutes: number;
  effectiveIntervalMinutes: number;
  categories: string[];
  reverseRouteId: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: "SUCCESS" | "NO_DATA" | "FAILED" | "NOT_CONFIGURED" | null;
  lastError: string | null;
  consecutiveFails: number;
  nextRunAt: string;
  prices: PriceInfo[];
}

export interface Overview {
  provider: { id: string; label: string; isLive: boolean; isDemo: boolean; configured: boolean; reason?: string; knownCategories: string[] };
  worker: { beatAt: string; alive: boolean } | null;
  routes: RouteOverview[];
  serverTime: string;
}

export const PRICE_TYPE_SHORT: Record<string, string> = {
  UPFRONT: "Festpreis",
  RANGE: "Spanne (Schätzung)",
  MANUAL: "Manuell (App)",
  DEMO: "DEMO",
};
