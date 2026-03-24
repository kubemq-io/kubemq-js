import { describe, it, expect } from 'vitest';
import { CallbackDispatcher } from '../../src/internal/concurrency/callback-dispatcher.js';
import { createTestLogger } from '../fixtures/test-helpers.js';
import type { KubeMQError } from '../../src/errors.js';
import { HandlerError } from '../../src/errors.js';

function createDispatcher<T>(maxConcurrent = 1, onError?: (err: KubeMQError) => void) {
  const logger = createTestLogger();
  const errors: KubeMQError[] = [];
  const dispatcher = new CallbackDispatcher<T>({
    maxConcurrent,
    logger,
    onError: onError ?? ((err) => errors.push(err)),
  });
  return { dispatcher, logger, errors };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('CallbackDispatcher', () => {
  it('dispatches a single callback', async () => {
    const { dispatcher } = createDispatcher<string>();
    const received: string[] = [];

    dispatcher.dispatch((msg) => {
      received.push(msg);
    }, 'hello');
    await dispatcher.drain();

    expect(received).toEqual(['hello']);
  });

  it('dispatches multiple messages sequentially with maxConcurrent=1', async () => {
    const { dispatcher } = createDispatcher<number>(1);
    const order: number[] = [];

    for (let i = 0; i < 5; i++) {
      dispatcher.dispatch(async (msg) => {
        await sleep(5);
        order.push(msg);
      }, i);
    }
    await dispatcher.drain();

    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  it('allows concurrent dispatch with maxConcurrent > 1', async () => {
    const { dispatcher } = createDispatcher<number>(3);
    let peakConcurrent = 0;
    let currentConcurrent = 0;

    const _promises: void[] = [];
    for (let i = 0; i < 6; i++) {
      dispatcher.dispatch(async () => {
        currentConcurrent++;
        peakConcurrent = Math.max(peakConcurrent, currentConcurrent);
        await sleep(20);
        currentConcurrent--;
      }, i);
    }
    await dispatcher.drain();

    expect(peakConcurrent).toBeGreaterThan(1);
    expect(peakConcurrent).toBeLessThanOrEqual(3);
  });

  it('reports callback errors to onError without crashing', async () => {
    const { dispatcher, errors, logger } = createDispatcher<string>();

    dispatcher.dispatch(() => {
      throw new Error('handler boom');
    }, 'bad-msg');
    await dispatcher.drain();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(HandlerError);
    expect(errors[0]!.message).toContain('handler boom');

    const errorLogs = logger.entries.filter((e) => e.level === 'error');
    expect(errorLogs.length).toBeGreaterThan(0);
  });

  it('reports async callback errors to onError', async () => {
    const { dispatcher, errors } = createDispatcher<string>();

    dispatcher.dispatch(async () => {
      await sleep(1);
      throw new Error('async boom');
    }, 'async-bad');
    await dispatcher.drain();

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('async boom');
  });

  it('reports non-Error throws to onError', async () => {
    const { dispatcher, errors } = createDispatcher<string>();

    dispatcher.dispatch(() => {
      throw 'string error';
    }, 'non-error');
    await dispatcher.drain();

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('string error');
  });

  it('close() prevents new dispatches', async () => {
    const { dispatcher } = createDispatcher<string>();
    const received: string[] = [];

    dispatcher.close();
    dispatcher.dispatch((msg) => {
      received.push(msg);
    }, 'should-not-arrive');

    await sleep(10);
    expect(received).toHaveLength(0);
  });

  it('isClosed reflects closed state', () => {
    const { dispatcher } = createDispatcher<string>();

    expect(dispatcher.isClosed).toBe(false);
    dispatcher.close();
    expect(dispatcher.isClosed).toBe(true);
  });

  it('drain() resolves immediately when no callbacks are active', async () => {
    const { dispatcher } = createDispatcher<string>();
    await expect(dispatcher.drain()).resolves.toBeUndefined();
  });

  it('drain() waits for in-flight callbacks to complete', async () => {
    const { dispatcher } = createDispatcher<string>();
    let finished = false;

    dispatcher.dispatch(async () => {
      await sleep(30);
      finished = true;
    }, 'slow');

    expect(finished).toBe(false);
    await dispatcher.drain();
    expect(finished).toBe(true);
  });

  it('inFlightCount tracks active callbacks', async () => {
    const { dispatcher } = createDispatcher<string>(5);
    let resolve1!: () => void;
    let resolve2!: () => void;
    const p1 = new Promise<void>((r) => {
      resolve1 = r;
    });
    const p2 = new Promise<void>((r) => {
      resolve2 = r;
    });

    expect(dispatcher.inFlightCount).toBe(0);

    dispatcher.dispatch(async () => {
      await p1;
    }, 'a');
    dispatcher.dispatch(async () => {
      await p2;
    }, 'b');

    await sleep(5);
    expect(dispatcher.inFlightCount).toBe(2);

    resolve1();
    await sleep(5);
    expect(dispatcher.inFlightCount).toBe(1);

    resolve2();
    await dispatcher.drain();
    expect(dispatcher.inFlightCount).toBe(0);
  });

  it('multiple drain() calls all resolve', async () => {
    const { dispatcher } = createDispatcher<string>();

    dispatcher.dispatch(async () => {
      await sleep(20);
    }, 'msg');

    const results = await Promise.all([dispatcher.drain(), dispatcher.drain(), dispatcher.drain()]);

    expect(results).toEqual([undefined, undefined, undefined]);
  });

  // ─── High / Low Water Mark & Drop Mode Tests ───

  it('high water mark triggers onHighWater when queue is full', async () => {
    const logger = createTestLogger();
    const errors: KubeMQError[] = [];
    const highWaterCalls: number[] = [];
    const lowWaterCalls: number[] = [];
    const dispatcher = new CallbackDispatcher<string>({
      maxConcurrent: 1,
      maxQueueDepth: 3,
      dropOnHighWater: false,
      logger,
      onError: (err) => errors.push(err),
      onHighWater: () => highWaterCalls.push(Date.now()),
      onLowWater: () => lowWaterCalls.push(Date.now()),
    });

    // Dispatch 5 slow handlers — with maxConcurrent=1, the queue will fill up
    for (let i = 0; i < 5; i++) {
      dispatcher.dispatch(async () => {
        await sleep(20);
      }, `msg-${i}`);
    }

    // Give the event loop a tick so the semaphore queue builds up
    await sleep(5);

    expect(highWaterCalls.length).toBe(1);
    expect((dispatcher as any)._paused).toBe(true);

    dispatcher.close();
  });

  it('high water mark not triggered below threshold', async () => {
    const logger = createTestLogger();
    const errors: KubeMQError[] = [];
    const highWaterCalls: number[] = [];
    const dispatcher = new CallbackDispatcher<string>({
      maxConcurrent: 1,
      maxQueueDepth: 10,
      dropOnHighWater: false,
      logger,
      onError: (err) => errors.push(err),
      onHighWater: () => highWaterCalls.push(Date.now()),
    });

    // Dispatch only 3 fast handlers — should not trigger high water (maxQueueDepth=10)
    for (let i = 0; i < 3; i++) {
      dispatcher.dispatch(async () => {
        await sleep(1);
      }, `msg-${i}`);
    }

    await dispatcher.drain();

    expect(highWaterCalls.length).toBe(0);
  });

  it('drop mode silently drops when queue full', async () => {
    const logger = createTestLogger();
    const errors: KubeMQError[] = [];
    const received: string[] = [];
    const dispatcher = new CallbackDispatcher<string>({
      maxConcurrent: 1,
      maxQueueDepth: 2,
      dropOnHighWater: true,
      logger,
      onError: (err) => errors.push(err),
    });

    // Dispatch 4 slow handlers — first one runs, next fill queue, rest get dropped
    for (let i = 0; i < 4; i++) {
      dispatcher.dispatch(async (msg) => {
        await sleep(20);
        received.push(msg);
      }, `msg-${i}`);
    }

    await dispatcher.drain();

    // Some messages should have been dropped
    expect(dispatcher.dropCount).toBeGreaterThan(0);
    expect(received.length).toBeLessThan(4);
  });

  it('dropCount getter returns correct count', async () => {
    const logger = createTestLogger();
    const errors: KubeMQError[] = [];
    const received: string[] = [];
    const dispatcher = new CallbackDispatcher<string>({
      maxConcurrent: 1,
      maxQueueDepth: 2,
      dropOnHighWater: true,
      logger,
      onError: (err) => errors.push(err),
    });

    for (let i = 0; i < 6; i++) {
      dispatcher.dispatch(async (msg) => {
        await sleep(20);
        received.push(msg);
      }, `msg-${i}`);
    }

    await dispatcher.drain();

    // dropCount + received should equal total dispatched
    expect(dispatcher.dropCount + received.length).toBe(6);
    expect(dispatcher.dropCount).toBeGreaterThan(0);
  });

  it('onHighWater not called in drop mode', async () => {
    const logger = createTestLogger();
    const errors: KubeMQError[] = [];
    const highWaterCalls: number[] = [];
    const dispatcher = new CallbackDispatcher<string>({
      maxConcurrent: 1,
      maxQueueDepth: 2,
      dropOnHighWater: true,
      logger,
      onError: (err) => errors.push(err),
      onHighWater: () => highWaterCalls.push(Date.now()),
    });

    for (let i = 0; i < 5; i++) {
      dispatcher.dispatch(async () => {
        await sleep(20);
      }, `msg-${i}`);
    }

    await dispatcher.drain();

    // In drop mode, onHighWater should never be called
    expect(highWaterCalls.length).toBe(0);
  });

  it('low water mark triggers onLowWater when queue drains below half', async () => {
    const logger = createTestLogger();
    const errors: KubeMQError[] = [];
    const highWaterCalls: number[] = [];
    const lowWaterCalls: number[] = [];
    const dispatcher = new CallbackDispatcher<string>({
      maxConcurrent: 1,
      maxQueueDepth: 3,
      dropOnHighWater: false,
      logger,
      onError: (err) => errors.push(err),
      onHighWater: () => highWaterCalls.push(Date.now()),
      onLowWater: () => lowWaterCalls.push(Date.now()),
    });

    // With maxConcurrent=1 and maxQueueDepth=3, iteration 5 will see
    // semaphore.waiting=3 and trigger high water. As handlers complete
    // and waiting drops below 3/2=1.5, low water will trigger.
    for (let i = 0; i < 6; i++) {
      dispatcher.dispatch(async () => {
        await sleep(15);
      }, `msg-${i}`);
    }

    // Wait for all to complete — low water should trigger as queue drains
    await dispatcher.drain();

    expect(highWaterCalls.length).toBeGreaterThanOrEqual(1);
    expect(lowWaterCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('onHighWater only called once while paused', async () => {
    const logger = createTestLogger();
    const errors: KubeMQError[] = [];
    const highWaterCalls: number[] = [];
    const dispatcher = new CallbackDispatcher<string>({
      maxConcurrent: 1,
      maxQueueDepth: 3,
      dropOnHighWater: false,
      logger,
      onError: (err) => errors.push(err),
      onHighWater: () => highWaterCalls.push(Date.now()),
    });

    // Dispatch many items past the threshold — onHighWater should only fire once
    for (let i = 0; i < 8; i++) {
      dispatcher.dispatch(async () => {
        await sleep(10);
      }, `msg-${i}`);
    }

    await sleep(5);

    // Should only be called once even though multiple dispatches exceed the threshold
    expect(highWaterCalls.length).toBe(1);

    dispatcher.close();
  });

  it('close resolves pending drain waiters', async () => {
    const logger = createTestLogger();
    const errors: KubeMQError[] = [];
    const dispatcher = new CallbackDispatcher<string>({
      maxConcurrent: 1,
      logger,
      onError: (err) => errors.push(err),
    });

    // Dispatch a slow handler so drain() will be pending
    dispatcher.dispatch(async () => {
      await sleep(500);
    }, 'slow');

    // Start drain — it won't resolve because the handler is slow
    const drainPromise = dispatcher.drain();

    // Close should resolve pending drain waiters
    await sleep(5);
    dispatcher.close();

    // drain should now resolve (not hang)
    await expect(drainPromise).resolves.toBeUndefined();
  });
});
