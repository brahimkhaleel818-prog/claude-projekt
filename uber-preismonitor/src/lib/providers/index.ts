import { env } from "../env";
import { DemoProvider } from "./demo";
import type { PriceProvider } from "./types";
import { UberGuestRidesProvider } from "./uber-guest-rides";
import { UberRidersV12Provider } from "./uber-riders-v12";

export const PROVIDER_IDS = ["none", "uber-guest-rides", "uber-riders-v12", "demo"] as const;

const registry: Record<string, () => PriceProvider> = {
  "uber-guest-rides": () => new UberGuestRidesProvider(),
  "uber-riders-v12": () => new UberRidersV12Provider(),
  demo: () => new DemoProvider(),
};

let cached: { id: string; provider: PriceProvider | null } | null = null;

/** Aktive Datenquelle laut PRICE_PROVIDER (null = keine Quelle). */
export function getActiveProvider(): PriceProvider | null {
  const id = env.priceProvider;
  if (cached?.id === id) return cached.provider;
  const factory = registry[id];
  cached = { id, provider: factory ? factory() : null };
  return cached.provider;
}

export interface ProviderInfo {
  id: string;
  label: string;
  isLive: boolean;
  isDemo: boolean;
  configured: boolean;
  reason?: string;
  description: string;
  knownCategories: string[];
}

export function describeActiveProvider(): ProviderInfo {
  const p = getActiveProvider();
  if (!p)
    return {
      id: "none",
      label: "Keine Datenquelle",
      isLive: false,
      isDemo: false,
      configured: false,
      reason:
        env.priceProvider === "none"
          ? "PRICE_PROVIDER ist nicht gesetzt – es werden keine Preise abgefragt."
          : `Unbekannte Datenquelle "${env.priceProvider}"`,
      description: "Ohne freigeschaltete Uber-API werden keine Preise angezeigt.",
      knownCategories: [],
    };
  const st = p.status();
  return {
    id: p.id,
    label: p.label,
    isLive: p.isLive,
    isDemo: p.isDemo,
    configured: st.configured,
    reason: st.reason,
    description: p.description,
    knownCategories: p.knownCategories,
  };
}

/** Sollen Demo-Daten angezeigt werden? Nur wenn die Demo-Quelle aktiv ist. */
export function showDemoData(): boolean {
  return env.priceProvider === "demo";
}

export type { PriceProvider } from "./types";
