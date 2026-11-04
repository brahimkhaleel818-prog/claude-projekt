import { ProviderError } from "./providers/types";

export interface RetryOptions {
  retries: number; // zusätzliche Versuche nach dem ersten
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

export function backoffDelay(attempt: number, base = 1000, max = 30_000, jitter = Math.random()): number {
  const exp = Math.min(max, base * 2 ** (attempt - 1));
  return Math.round(exp * (0.75 + jitter * 0.5));
}

/** Führt fn aus und wiederholt bei wiederholbaren Fehlern mit exponentiellem Backoff. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<{ value: T; attempts: number }> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return { value: await fn(attempt), attempts: attempt };
    } catch (err) {
      const retryable = err instanceof ProviderError ? err.retryable : false;
      if (!retryable || attempt > opts.retries) {
        (err as { attempts?: number }).attempts = attempt;
        throw err;
      }
      let delay = backoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      if (err instanceof ProviderError && err.retryAfterMs) delay = Math.max(delay, Math.min(err.retryAfterMs, 120_000));
      opts.onRetry?.(attempt, err, delay);
      await sleep(delay);
    }
  }
}
