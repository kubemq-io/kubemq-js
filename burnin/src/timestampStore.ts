/**
 * Send timestamp store for end-to-end latency measurement.
 * Maps (producerId, seq) → process.hrtime.bigint() value.
 */
export class TimestampStore {
  private store = new Map<string, bigint>();

  store_ts(producerId: string, seq: number): void {
    this.store.set(`${producerId}:${seq}`, process.hrtime.bigint());
  }

  loadAndDelete(producerId: string, seq: number): bigint | undefined {
    const key = `${producerId}:${seq}`;
    const val = this.store.get(key);
    if (val !== undefined) this.store.delete(key);
    return val;
  }

  purge(maxAgeMs: number): number {
    const cutoff = process.hrtime.bigint() - BigInt(maxAgeMs) * 1_000_000n;
    let removed = 0;
    for (const [key, ts] of this.store) {
      if (ts < cutoff) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.store.size;
  }
}
