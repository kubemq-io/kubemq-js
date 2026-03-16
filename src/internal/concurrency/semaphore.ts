/**
 * Lightweight async semaphore for callback concurrency control.
 * Implements the p-limit pattern inline — no external dependencies.
 */
export class AsyncSemaphore {
  private permits: number;
  private readonly waiters: (() => void)[] = [];

  constructor(maxConcurrency: number) {
    if (maxConcurrency < 1) {
      throw new RangeError(`maxConcurrency must be >= 1, got ${String(maxConcurrency)}`);
    }
    this.permits = maxConcurrency;
  }

  /**
   * Acquire a permit. Resolves immediately if available,
   * otherwise waits until one is released.
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /** Release a permit. Wakes the oldest waiting acquirer if any. */
  release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  /** Execute an async function with semaphore-controlled concurrency. */
  async run<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /** Number of tasks currently waiting for a permit. */
  get waiting(): number {
    return this.waiters.length;
  }

  /** Number of available permits. */
  get available(): number {
    return this.permits;
  }
}
