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
});
