/** @internal */

export class InFlightTracker {
  private readonly pending = new Set<Promise<unknown>>();

  track<T>(promise: Promise<T>): Promise<T> {
    this.pending.add(promise);
    const cleanup = (): void => {
      this.pending.delete(promise);
    };
    promise.then(cleanup, cleanup);
    return promise;
  }

  async waitForAll(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }

  get count(): number {
    return this.pending.size;
  }
}
