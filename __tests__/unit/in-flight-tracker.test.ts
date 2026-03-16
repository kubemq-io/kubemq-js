import { describe, it, expect } from 'vitest';
import { InFlightTracker } from '../../src/internal/transport/in-flight-tracker.js';

describe('InFlightTracker', () => {
  it('count starts at 0', () => {
    const tracker = new InFlightTracker();
    expect(tracker.count).toBe(0);
  });

  it('track adds to count', () => {
    const tracker = new InFlightTracker();
    const deferred = Promise.withResolvers<void>();

    tracker.track(deferred.promise);
    expect(tracker.count).toBe(1);

    deferred.resolve();
  });

  it('resolved promise removes from count', async () => {
    const tracker = new InFlightTracker();
    const deferred = Promise.withResolvers<string>();

    tracker.track(deferred.promise);
    expect(tracker.count).toBe(1);

    deferred.resolve('done');
    await deferred.promise;

    await new Promise((r) => setTimeout(r, 0));
    expect(tracker.count).toBe(0);
  });

  it('rejected promise removes from count', async () => {
    const tracker = new InFlightTracker();
    const deferred = Promise.withResolvers<string>();

    tracker.track(deferred.promise);
    expect(tracker.count).toBe(1);

    deferred.reject(new Error('fail'));
    await deferred.promise.catch(() => {});

    await new Promise((r) => setTimeout(r, 0));
    expect(tracker.count).toBe(0);
  });

  it('waitForAll resolves when all tracked promises settle', async () => {
    const tracker = new InFlightTracker();
    const d1 = Promise.withResolvers<void>();
    const d2 = Promise.withResolvers<void>();

    tracker.track(d1.promise);
    tracker.track(d2.promise);

    d1.resolve();
    d2.resolve();

    await tracker.waitForAll();
    expect(tracker.count).toBe(0);
  });

  it('waitForAll handles mix of resolved and rejected', async () => {
    const tracker = new InFlightTracker();
    const d1 = Promise.withResolvers<void>();
    const d2 = Promise.withResolvers<void>();

    tracker.track(d1.promise);
    tracker.track(d2.promise);

    d1.resolve();
    d2.reject(new Error('fail'));
    d2.promise.catch(() => {});

    await tracker.waitForAll();
    expect(tracker.count).toBe(0);
  });

  it('track returns the original promise value', async () => {
    const tracker = new InFlightTracker();
    const original = Promise.resolve(42);

    const tracked = tracker.track(original);
    expect(tracked).toBe(original);
    await expect(tracked).resolves.toBe(42);
  });

  it('track returns the original promise identity', () => {
    const tracker = new InFlightTracker();
    const p = new Promise<void>(() => {});

    const result = tracker.track(p);
    expect(result).toBe(p);
  });
});
