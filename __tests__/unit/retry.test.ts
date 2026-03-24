import { describe, it, expect, vi } from 'vitest';
import {
  withRetry,
  computeBackoffMs,
  createRetryThrottle,
  createUnlimitedThrottle,
  resolveSignal,
} from '../../src/internal/middleware/retry.js';
import {
  TransientError,
  ValidationError,
  KubeMQTimeoutError,
  RetryExhaustedError,
  CancellationError,
  KubeMQError,
  ErrorCode,
} from '../../src/errors.js';
import { noopLogger } from '../../src/logger.js';

describe('computeBackoffMs', () => {
  const policy = {
    maxRetries: 3,
    initialBackoffMs: 500,
    maxBackoffMs: 30000,
    multiplier: 2.0,
    jitter: 'none' as const,
  };

  it('computes exponential backoff without jitter', () => {
    expect(computeBackoffMs(0, policy)).toBe(500);
    expect(computeBackoffMs(1, policy)).toBe(1000);
    expect(computeBackoffMs(2, policy)).toBe(2000);
    expect(computeBackoffMs(3, policy)).toBe(4000);
  });

  it('caps at maxBackoffMs', () => {
    expect(computeBackoffMs(10, policy)).toBe(30000);
  });

  it('full jitter produces values in [0, exponential]', () => {
    const fullPolicy = { ...policy, jitter: 'full' as const };
    for (let i = 0; i < 100; i++) {
      const val = computeBackoffMs(0, fullPolicy);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(500);
    }
  });

  it('equal jitter produces values in [half, exponential]', () => {
    const equalPolicy = { ...policy, jitter: 'equal' as const };
    for (let i = 0; i < 100; i++) {
      const val = computeBackoffMs(0, equalPolicy);
      expect(val).toBeGreaterThanOrEqual(250);
      expect(val).toBeLessThanOrEqual(500);
    }
  });

  it('equal jitter at higher attempts stays in [half, capped]', () => {
    const equalPolicy = { ...policy, jitter: 'equal' as const };
    for (let i = 0; i < 50; i++) {
      const val = computeBackoffMs(2, equalPolicy);
      expect(val).toBeGreaterThanOrEqual(1000);
      expect(val).toBeLessThanOrEqual(2000);
    }
  });
});

describe('withRetry', () => {
  const fastPolicy = {
    maxRetries: 3,
    initialBackoffMs: 1,
    maxBackoffMs: 10,
    multiplier: 2,
    jitter: 'none' as const,
  };
  const ctx = { operation: 'sendEvent', operationType: 'events' as const, channel: 'test' };

  it('succeeds on first attempt without retrying', async () => {
    let callCount = 0;
    const result = await withRetry(
      async () => {
        callCount++;
        return 'ok';
      },
      fastPolicy,
      ctx,
      noopLogger,
      createUnlimitedThrottle(),
    );
    expect(result).toBe('ok');
    expect(callCount).toBe(1);
  });

  it('retries transient error and succeeds on second attempt', async () => {
    let callCount = 0;
    const result = await withRetry(
      async () => {
        callCount++;
        if (callCount === 1) {
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'unavailable',
            operation: 'sendEvent',
            isRetryable: true,
          });
        }
        return 'success';
      },
      fastPolicy,
      ctx,
      noopLogger,
      createUnlimitedThrottle(),
    );
    expect(result).toBe('success');
    expect(callCount).toBe(2);
  });

  it('does not retry non-retryable errors', async () => {
    let callCount = 0;
    await expect(
      withRetry(
        async () => {
          callCount++;
          throw new ValidationError({
            code: ErrorCode.ValidationFailed,
            message: 'invalid',
            operation: 'sendEvent',
            isRetryable: false,
          });
        },
        fastPolicy,
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
      ),
    ).rejects.toThrow(ValidationError);
    expect(callCount).toBe(1);
  });

  it('does not retry DEADLINE_EXCEEDED for non-idempotent operations', async () => {
    let callCount = 0;
    await expect(
      withRetry(
        async () => {
          callCount++;
          throw new KubeMQTimeoutError({
            code: ErrorCode.Timeout,
            message: 'deadline',
            operation: 'sendQueueMessage',
            isRetryable: true,
            statusCode: 4,
          });
        },
        fastPolicy,
        { operation: 'sendQueueMessage', operationType: 'queueSend' as const, channel: 'orders' },
        noopLogger,
        createUnlimitedThrottle(),
      ),
    ).rejects.toThrow(KubeMQTimeoutError);
    expect(callCount).toBe(1);
  });

  it('throws RetryExhaustedError after max retries', async () => {
    let callCount = 0;
    try {
      await withRetry(
        async () => {
          callCount++;
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'down',
            operation: 'sendEvent',
            isRetryable: true,
          });
        },
        { ...fastPolicy, maxRetries: 2 },
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
      );
      expect.unreachable('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(RetryExhaustedError);
      const retryErr = err as RetryExhaustedError;
      expect(retryErr.attempts).toBe(2);
      expect(retryErr.totalDuration).toBeGreaterThanOrEqual(0);
      expect(retryErr.lastError).toBeInstanceOf(TransientError);
    }
    expect(callCount).toBe(3);
  });

  it('respects maxRetries=0 (no retries)', async () => {
    let callCount = 0;
    await expect(
      withRetry(
        async () => {
          callCount++;
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'down',
            operation: 'sendEvent',
            isRetryable: true,
          });
        },
        { ...fastPolicy, maxRetries: 0 },
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
      ),
    ).rejects.toThrow(RetryExhaustedError);
    expect(callCount).toBe(1);
  });

  it('respects AbortSignal cancellation (pre-aborted)', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      withRetry(
        async () => 'never',
        fastPolicy,
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
        controller.signal,
      ),
    ).rejects.toThrow();
  });

  it('caps UNKNOWN status (code 2) at 1 retry regardless of maxRetries', async () => {
    let callCount = 0;
    await expect(
      withRetry(
        async () => {
          callCount++;
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'unknown error',
            operation: 'sendEvent',
            isRetryable: true,
            statusCode: 2,
          });
        },
        { ...fastPolicy, maxRetries: 5 },
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
      ),
    ).rejects.toThrow(TransientError);
    expect(callCount).toBe(2);
  });

  it('UNKNOWN status allows first retry but not second', async () => {
    let callCount = 0;
    try {
      await withRetry(
        async () => {
          callCount++;
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'unknown',
            operation: 'sendEvent',
            isRetryable: true,
            statusCode: 2,
          });
        },
        { ...fastPolicy, maxRetries: 10 },
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
      );
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(TransientError);
      expect((err as KubeMQError).statusCode).toBe(2);
    }
    expect(callCount).toBe(2);
  });

  it('throws when retry throttle rejects (tryAcquire returns false)', async () => {
    const saturatedThrottle = {
      tryAcquire: () => false,
      release: vi.fn(),
    };
    let callCount = 0;
    await expect(
      withRetry(
        async () => {
          callCount++;
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'down',
            operation: 'sendEvent',
            isRetryable: true,
          });
        },
        fastPolicy,
        ctx,
        noopLogger,
        saturatedThrottle,
      ),
    ).rejects.toThrow(TransientError);
    expect(callCount).toBe(1);
    expect(saturatedThrottle.release).not.toHaveBeenCalled();
  });

  it('does not retry non-KubeMQError errors', async () => {
    let callCount = 0;
    await expect(
      withRetry(
        async () => {
          callCount++;
          throw new Error('generic error');
        },
        fastPolicy,
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
      ),
    ).rejects.toThrow('generic error');
    expect(callCount).toBe(1);
  });

  it('wraps timeout abort reason as KubeMQTimeoutError', async () => {
    const controller = new AbortController();
    const reason = new DOMException('signal timed out', 'TimeoutError');
    controller.abort(reason);

    await expect(
      withRetry(
        async () => 'never',
        fastPolicy,
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
        controller.signal,
      ),
    ).rejects.toThrow(KubeMQTimeoutError);
  });
});

describe('RetryHooks', () => {
  const fastPolicy = {
    maxRetries: 3,
    initialBackoffMs: 1,
    maxBackoffMs: 10,
    multiplier: 2,
    jitter: 'none' as const,
  };
  const ctx = { operation: 'sendEvent', operationType: 'events' as const, channel: 'test' };

  it('calls onRetry for each retry attempt', async () => {
    let callCount = 0;
    const onRetry = vi.fn();
    await withRetry(
      async () => {
        callCount++;
        if (callCount <= 2) {
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'unavailable',
            operation: 'sendEvent',
            isRetryable: true,
          });
        }
        return 'ok';
      },
      fastPolicy,
      ctx,
      noopLogger,
      createUnlimitedThrottle(),
      undefined,
      { onRetry },
    );
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
  });

  it('calls onExhausted when retries are exhausted', async () => {
    const onExhausted = vi.fn();
    try {
      await withRetry(
        async () => {
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'down',
            operation: 'sendEvent',
            isRetryable: true,
          });
        },
        { ...fastPolicy, maxRetries: 2 },
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
        undefined,
        { onExhausted },
      );
    } catch {
      // expected
    }
    expect(onExhausted).toHaveBeenCalledOnce();
  });

  it('does not call hooks on successful first attempt', async () => {
    const onRetry = vi.fn();
    const onExhausted = vi.fn();
    await withRetry(
      async () => 'ok',
      fastPolicy,
      ctx,
      noopLogger,
      createUnlimitedThrottle(),
      undefined,
      { onRetry, onExhausted },
    );
    expect(onRetry).not.toHaveBeenCalled();
    expect(onExhausted).not.toHaveBeenCalled();
  });

  it('does not call onExhausted on non-retryable errors', async () => {
    const onExhausted = vi.fn();
    try {
      await withRetry(
        async () => {
          throw new ValidationError({
            code: ErrorCode.ValidationFailed,
            message: 'bad',
            operation: 'sendEvent',
            isRetryable: false,
          });
        },
        fastPolicy,
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
        undefined,
        { onExhausted },
      );
    } catch {
      // expected
    }
    expect(onExhausted).not.toHaveBeenCalled();
  });
});

describe('RetryThrottle', () => {
  it('blocks acquisition when limit reached', () => {
    const throttle = createRetryThrottle(2);
    expect(throttle.tryAcquire()).toBe(true);
    expect(throttle.tryAcquire()).toBe(true);
    expect(throttle.tryAcquire()).toBe(false);
    throttle.release();
    expect(throttle.tryAcquire()).toBe(true);
  });

  it('unlimited throttle (0) always allows', () => {
    const throttle = createRetryThrottle(0);
    for (let i = 0; i < 100; i++) {
      expect(throttle.tryAcquire()).toBe(true);
    }
  });

  it('createUnlimitedThrottle always allows', () => {
    const throttle = createUnlimitedThrottle();
    for (let i = 0; i < 100; i++) {
      expect(throttle.tryAcquire()).toBe(true);
    }
  });

  it('release decrements active count', () => {
    const throttle = createRetryThrottle(1);
    expect(throttle.tryAcquire()).toBe(true);
    expect(throttle.tryAcquire()).toBe(false);
    throttle.release();
    expect(throttle.tryAcquire()).toBe(true);
  });

  it('createUnlimitedThrottle release is a no-op', () => {
    const throttle = createUnlimitedThrottle();
    expect(() => throttle.release()).not.toThrow();
  });

  it('release does not go below zero', () => {
    const throttle = createRetryThrottle(1);
    throttle.release();
    expect(throttle.tryAcquire()).toBe(true);
    expect(throttle.tryAcquire()).toBe(false);
  });
});

describe('resolveSignal', () => {
  it('returns AbortSignal.timeout for default when no opts', () => {
    const signal = resolveSignal(5000);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it('returns AbortSignal.timeout for default when opts is undefined', () => {
    const signal = resolveSignal(5000, undefined);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it('returns opts.signal when only signal is provided', () => {
    const controller = new AbortController();
    const signal = resolveSignal(5000, { signal: controller.signal });
    expect(signal).toBe(controller.signal);
  });

  it('returns timeout signal when only timeout is provided', () => {
    const signal = resolveSignal(5000, { timeout: 3000 });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it('returns composed signal when both signal and timeout are provided', () => {
    const controller = new AbortController();
    const signal = resolveSignal(5000, { signal: controller.signal, timeout: 3000 });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal).not.toBe(controller.signal);
  });

  it('composed signal aborts when user signal aborts', () => {
    const controller = new AbortController();
    const signal = resolveSignal(5000, { signal: controller.signal, timeout: 60_000 });
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it('uses timeout=0 as explicit value (not falsy)', () => {
    const signal = resolveSignal(5000, { timeout: 0 });
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});

describe('withRetry — abort signal during backoff', () => {
  const retryPolicy = {
    maxRetries: 5,
    initialBackoffMs: 5000,
    maxBackoffMs: 30000,
    multiplier: 2,
    jitter: 'none' as const,
  };
  const ctx = { operation: 'sendEvent', operationType: 'events' as const, channel: 'test' };

  it('abort during backoff sleep rejects with CancellationError', async () => {
    const controller = new AbortController();
    let callCount = 0;

    const promise = withRetry(
      async () => {
        callCount++;
        throw new TransientError({
          code: ErrorCode.Unavailable,
          message: 'unavailable',
          operation: 'sendEvent',
          isRetryable: true,
        });
      },
      retryPolicy,
      ctx,
      noopLogger,
      createUnlimitedThrottle(),
      controller.signal,
    );

    // Let the first attempt fail and enter backoff
    await new Promise((r) => setTimeout(r, 20));
    controller.abort();

    await expect(promise).rejects.toThrow();
    expect(callCount).toBe(1);
  });

  it('pre-aborted signal rejects immediately with CancellationError', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      withRetry(
        async () => 'never',
        retryPolicy,
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
        controller.signal,
      ),
    ).rejects.toThrow();
  });

  it('AbortSignal.timeout wraps as KubeMQTimeoutError', async () => {
    const signal = AbortSignal.timeout(10);

    await expect(
      withRetry(
        async () => {
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'unavailable',
            operation: 'sendEvent',
            isRetryable: true,
          });
        },
        retryPolicy,
        ctx,
        noopLogger,
        createUnlimitedThrottle(),
        signal,
      ),
    ).rejects.toThrow();
  });
});
