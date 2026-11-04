import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function eur(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "Nicht verfügbar";
  return v.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pctStr(v: number | null | undefined): string {
  if (v === null || v === undefined) return "–";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
}

export const CATEGORY_COLORS: Record<string, string> = {
  uberx: "#60a5fa",
  comfort: "#a78bfa",
  uberxl: "#f59e0b",
  black: "#e4e4e7",
  green: "#2dd4bf",
  van: "#f472b6",
  wav: "#94a3b8",
  taxi: "#facc15",
  premier: "#fb923c",
};
const FALLBACK = ["#38bdf8", "#c084fc", "#fbbf24", "#f472b6", "#a3e635", "#fda4af"];
export function categoryColor(key: string, i = 0) {
  return CATEGORY_COLORS[key] ?? FALLBACK[i % FALLBACK.length];
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "content-type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === "object" && data && "error" in data ? String((data as { error: string }).error) : `HTTP ${res.status}`;
    const details = typeof data === "object" && data && "details" in data ? ` (${(data as { details: string[] }).details.join(", ")})` : "";
    throw new Error(msg + details);
  }
  return data as T;
}
