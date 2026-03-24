/**
 * Token-bucket rate limiter with a single recurring refill timer.
 * Instead of creating a new setTimeout per wait(), a single setInterval
 * refills tokens and drains a queue of waiting callers.
 * Spec Section 4.1: +/-5% accuracy over 10s windows.
 */
export class RateLimiter {
  private rate: number;
  private tokens: number;
  private maxTokens: number;
  private lastRefill: number;
  private waitQueue: { resolve: (v: boolean) => void; onAbort: () => void }[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  private static readonly REFILL_INTERVAL_MS = 10;

  constructor(rate: number) {
    this.rate = rate;
    this.maxTokens = Math.max(rate, 1);
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  async wait(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;
    if (this.rate <= 0) return true;

    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const entry = {
        resolve,
        onAbort: () => {
          const idx = this.waitQueue.indexOf(entry);
          if (idx !== -1) this.waitQueue.splice(idx, 1);
          resolve(false);
        },
      };
      this.waitQueue.push(entry);
      signal.addEventListener('abort', entry.onAbort, { once: true });
      this.ensureTimer();
    });
  }

  private ensureTimer(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      this.refill();
      while (this.waitQueue.length > 0 && this.tokens >= 1) {
        this.tokens--;
        const entry = this.waitQueue.shift()!;
        entry.resolve(true);
      }
      if (this.waitQueue.length === 0 && this.timer !== null) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, RateLimiter.REFILL_INTERVAL_MS);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.rate);
    this.lastRefill = now;
  }
}
