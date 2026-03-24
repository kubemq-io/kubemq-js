/**
 * Peak rate tracking and lightweight sorted-array latency accumulation.
 * Replaces hdr-histogram-js to avoid loading its WASM binary (~15-25 MB).
 */

const WINDOW_SIZE = 10;
const SLIDING_RATE_WINDOW = 30;

export class SlidingRateTracker {
  private buckets = new Array<number>(SLIDING_RATE_WINDOW).fill(0);
  private idx = 0;
  private totalSlots = 0;

  record(): void {
    this.buckets[this.idx]++;
  }

  advance(): void {
    this.idx = (this.idx + 1) % SLIDING_RATE_WINDOW;
    this.buckets[this.idx] = 0;
    if (this.totalSlots < SLIDING_RATE_WINDOW) this.totalSlots++;
  }

  rate(): number {
    if (this.totalSlots === 0) return 0;
    const filled = Math.min(this.totalSlots, SLIDING_RATE_WINDOW);
    let sum = 0;
    for (let i = 0; i < SLIDING_RATE_WINDOW; i++) sum += this.buckets[i];
    return sum / filled;
  }

  reset(): void {
    this.buckets.fill(0);
    this.totalSlots = 0;
  }
}

export class PeakRateTracker {
  private buckets = new Array<number>(WINDOW_SIZE).fill(0);
  private idx = 0;
  private _peak = 0;

  record(): void {
    this.buckets[this.idx]++;
  }

  advance(): void {
    const total = this.buckets.reduce((a, b) => a + b, 0);
    const avg = total / WINDOW_SIZE;
    if (avg > this._peak) this._peak = avg;
    this.idx = (this.idx + 1) % WINDOW_SIZE;
    this.buckets[this.idx] = 0;
  }

  peak(): number {
    return this._peak;
  }

  reset(): void {
    this.buckets.fill(0);
    this._peak = 0;
  }
}

/**
 * Lightweight latency accumulator using a reservoir-sampled sorted array.
 * Trades precision for ~0 memory overhead vs HdrHistogram's pre-allocated buckets.
 * Keeps up to MAX_SAMPLES values; beyond that, uses reservoir sampling to maintain
 * a representative distribution without unbounded growth.
 */
const MAX_SAMPLES = 50_000;

export class LatencyAccumulator {
  private samples: number[] = [];
  private _count = 0;
  private sorted = false;

  /** Record latency in seconds */
  record(durationSec: number): void {
    let micros = Math.round(durationSec * 1_000_000);
    if (micros < 1) micros = 1;
    if (micros > 10_000_000) micros = 10_000_000;
    this._count++;
    if (this.samples.length < MAX_SAMPLES) {
      this.samples.push(micros);
    } else {
      // Reservoir sampling: replace a random element with decreasing probability
      const idx = Math.floor(Math.random() * this._count);
      if (idx < MAX_SAMPLES) this.samples[idx] = micros;
    }
    this.sorted = false;
  }

  /** Get percentile in milliseconds */
  percentileMs(p: number): number {
    if (this.samples.length === 0) return 0;
    if (!this.sorted) {
      this.samples.sort((a, b) => a - b);
      this.sorted = true;
    }
    const idx = Math.min(Math.ceil((p / 100) * this.samples.length) - 1, this.samples.length - 1);
    return this.samples[Math.max(0, idx)] / 1000;
  }

  count(): number {
    return this._count;
  }

  reset(): void {
    this.samples.length = 0;
    this._count = 0;
    this.sorted = false;
  }
}
