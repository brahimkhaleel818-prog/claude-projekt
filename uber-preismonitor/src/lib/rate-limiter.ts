/**
 * Rate-Limiter mit gleitenden Fenstern (pro Minute und pro Stunde).
 * Zusätzlich kann die Quelle eine Zwangspause anordnen (HTTP 429 Retry-After).
 */
export class SlidingWindowLimiter {
  private stamps: number[] = [];
  private pausedUntil = 0;

  constructor(
    private readonly perMinute: number,
    private readonly perHour: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Wartezeit in ms bis zur nächsten erlaubten Anfrage (0 = sofort). */
  waitTime(): number {
    const t = this.now();
    this.stamps = this.stamps.filter((s) => t - s < 3_600_000);
    let wait = Math.max(0, this.pausedUntil - t);
    const lastMinute = this.stamps.filter((s) => t - s < 60_000);
    if (this.perMinute > 0 && lastMinute.length >= this.perMinute) {
      wait = Math.max(wait, lastMinute[lastMinute.length - this.perMinute] + 60_000 - t);
    }
    if (this.perHour > 0 && this.stamps.length >= this.perHour) {
      wait = Math.max(wait, this.stamps[this.stamps.length - this.perHour] + 3_600_000 - t);
    }
    return wait;
  }

  tryAcquire(): boolean {
    if (this.waitTime() > 0) return false;
    this.stamps.push(this.now());
    return true;
  }

  async acquire(maxWaitMs = 120_000): Promise<boolean> {
    const deadline = this.now() + maxWaitMs;
    for (;;) {
      if (this.tryAcquire()) return true;
      const w = this.waitTime();
      if (this.now() + w > deadline) return false;
      await new Promise((r) => setTimeout(r, Math.min(w, 5_000) + 5));
    }
  }

  pause(ms: number) {
    this.pausedUntil = Math.max(this.pausedUntil, this.now() + ms);
  }

  stats() {
    const t = this.now();
    return {
      lastMinute: this.stamps.filter((s) => t - s < 60_000).length,
      lastHour: this.stamps.filter((s) => t - s < 3_600_000).length,
      perMinute: this.perMinute,
      perHour: this.perHour,
      pausedUntil: this.pausedUntil > t ? new Date(this.pausedUntil).toISOString() : null,
    };
  }
}
