import { ProviderError } from "./types";

/** fetch mit Timeout; wandelt Netzwerk- und HTTP-Fehler in ProviderError um. */
export async function providerFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  const outer = init.signal;
  outer?.addEventListener("abort", () => ctrl.abort(), { once: true });
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    throw new ProviderError(`Netzwerkfehler: ${(err as Error).message}`, { retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

export function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const secs = Number(h);
  if (Number.isFinite(secs)) return secs * 1000;
  const date = Date.parse(h);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export async function errorFromResponse(res: Response, context: string): Promise<ProviderError> {
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 300);
  } catch {
    /* ignore */
  }
  const retryable = res.status === 429 || res.status >= 500;
  const hints: Record<number, string> = {
    401: "Zugangsdaten ungültig oder Token abgelaufen",
    403: "Kein Zugriff – API-Freigabe von Uber fehlt für diesen Endpunkt/Scope",
    404: "Endpunkt nicht gefunden",
    422: "Ungültige Anfrage (z. B. Koordinaten/Entfernung)",
    429: "Rate-Limit von Uber erreicht",
  };
  return new ProviderError(
    `${context}: HTTP ${res.status}${hints[res.status] ? ` – ${hints[res.status]}` : ""}${detail ? ` | ${detail}` : ""}`,
    { retryable, httpStatus: res.status, retryAfterMs: parseRetryAfter(res) },
  );
}
