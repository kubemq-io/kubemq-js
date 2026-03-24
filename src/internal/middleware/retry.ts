/** @internal — retry engine, not part of public API */

import type { RetryPolicy } from '../../options.js';
import type { Logger } from '../../logger.js';
import {
  KubeMQError,
  RetryExhaustedError,
  KubeMQTimeoutError,
  CancellationError,
} from '../../errors.js';

// ─── Operation Type & Idempotency ────────────────────────────────────

export type OperationType =
  | 'events'
  | 'eventsStore'
  | 'queueSend'
  | 'queueReceive'
  | 'command'
  | 'query'
  | 'subscribe';

const IDEMPOTENT_OPERATIONS: ReadonlySet<OperationType> = new Set([
  'events',
  'eventsStore',
  'subscribe',
]);

// ─── Retry Throttle ──────────────────────────────────────────────────

export interface RetryThrottle {
  tryAcquire(): boolean;
  release(): void;
}

export function createRetryThrottle(maxConcurrent: number): RetryThrottle {
  let active = 0;
  return {
    tryAcquire(): boolean {
      if (maxConcurrent <= 0) return true;
      if (active >= maxConcurrent) return false;
      active++;
      return true;
    },
    release(): void {
      if (active > 0) active--;
    },
  };
}

export function createUnlimitedThrottle(): RetryThrottle {
  return {
    tryAcquire: () => true,
    release: () => {
      /* noop */
    },
  };
}

// ─── Backoff Computation ─────────────────────────────────────────────

export function computeBackoffMs(attempt: number, policy: Readonly<RetryPolicy>): number {
  const exponential = Math.min(
    policy.maxBackoffMs,
    policy.initialBackoffMs * Math.pow(policy.multiplier, attempt),
  );

  switch (policy.jitter) {
    case 'full':
      return Math.random() * exponential;
    case 'equal': {
      const half = exponential / 2;
      return half + Math.random() * half;
    }
    case 'none':
      return exponential;
  }
}

// ─── Retry Context ───────────────────────────────────────────────────

export interface RetryContext {
  operation: string;
  operationType: OperationType;
  channel?: string;
  serverAddress?: string;
}

// ─── Signal Resolution ──────────────────────────────────────────────

/**
 * Compose an AbortSignal from OperationOptions and a default timeout.
 * Used by client-layer methods to create a unified signal for withRetry.
 *
 * L1 fix: prefer reusing caller's signal when available to reduce
 * AbortSignal.timeout() timer allocations under high throughput.
 */
export function resolveSignal(
  defaultTimeoutMs: number,
  opts?: { signal?: AbortSignal; timeout?: number },
): AbortSignal {
  if (opts?.signal && opts.timeout != null) {
    return AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeout)]);
  }
  if (opts?.signal) return opts.signal;
  if (opts?.timeout != null) return AbortSignal.timeout(opts.timeout);
  if (defaultTimeoutMs <= 0) return new AbortController().signal;
  return AbortSignal.timeout(defaultTimeoutMs);
}

/**
 * Resolve an AbortSignal only when the caller provides an explicit signal or timeout.
 * Returns `undefined` for the default-timeout-only case so callers can use a
 * gRPC deadline instead, avoiding OS timer allocations on the hot path.
 */
export function resolveSignalOptional(
  opts?: { signal?: AbortSignal; timeout?: number },
): AbortSignal | undefined {
  if (opts?.signal && opts.timeout != null) {
    return AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeout)]);
  }
  if (opts?.signal) return opts.signal;
  if (opts?.timeout != null) return AbortSignal.timeout(opts.timeout);
  return undefined;
}

/**
 * Compute a gRPC deadline Date for the given timeout configuration.
 * Used alongside resolveSignalOptional to avoid AbortSignal.timeout()
 * allocations when only the default timeout applies.
 */
export function resolveDeadline(
  defaultTimeoutMs: number,
  opts?: { timeout?: number },
): Date {
  const timeoutMs = opts?.timeout ?? defaultTimeoutMs;
  return new Date(Date.now() + (timeoutMs > 0 ? timeoutMs : 30_000));
}

// ─── Sleep with AbortSignal ─────────────────────────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason)));
      return;
    }
    const timer = setTimeout(resolve, ms);
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref();
    }
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason)));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

// ─── Retry Hooks ─────────────────────────────────────────────────────

export interface RetryHooks {
  onRetry?: (attempt: number, error: Error) => void;
  onExhausted?: () => void;
}

// ─── withRetry ───────────────────────────────────────────────────────

/**
 * Execute `fn` with automatic retry for retryable errors.
 *
 * - Non-retryable errors surface immediately.
 * - DEADLINE_EXCEEDED on non-idempotent operations is never retried.
 * - UNKNOWN status: at most 1 retry regardless of policy.
 * - Concurrent retries are throttled via `throttle`.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  policy: Readonly<RetryPolicy>,
  ctx: RetryContext,
  logger: Logger,
  throttle: RetryThrottle,
  parentSignal?: AbortSignal,
  hooks?: RetryHooks,
): Promise<T> {
  // Fast path: when no retries are configured, skip retry loop overhead
  // but preserve error semantics (non-retryable errors pass through,
  // retryable errors become RetryExhaustedError).
  if (policy.maxRetries === 0) {
    const t0 = Date.now();
    try {
      return await fn(parentSignal ?? new AbortController().signal);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!(error instanceof KubeMQError) || !error.isRetryable) {
        throw error;
      }
      hooks?.onExhausted?.();
      throw new RetryExhaustedError({
        message: `${ctx.operation} failed after 0 retries`,
        operation: ctx.operation,
        channel: ctx.channel,
        serverAddress: ctx.serverAddress,
        cause: error,
        suggestion: 'Increase maxRetries or check server health.',
        attempts: 0,
        totalDuration: Date.now() - t0,
        lastError: error,
      });
    }
  }

  const startTime = Date.now();
  let lastError: Error | undefined;
  const fallbackSignal = parentSignal ?? new AbortController().signal;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      parentSignal?.throwIfAborted();
      return await fn(fallbackSignal);
    } catch (err: unknown) {
      if (parentSignal?.aborted) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const reason = parentSignal.reason;
        if (reason instanceof DOMException && reason.name === 'TimeoutError') {
          throw new KubeMQTimeoutError({
            message: `${ctx.operation} timed out`,
            operation: ctx.operation,
            channel: ctx.channel,
            cause: reason,
            suggestion: 'Increase the timeout value.',
          });
        }
        throw new CancellationError({
          message: `${ctx.operation} cancelled`,
          operation: ctx.operation,
          channel: ctx.channel,
          cause: reason instanceof Error ? reason : undefined,
        });
      }

      lastError = err instanceof Error ? err : new Error(String(err));

      if (!(lastError instanceof KubeMQError)) {
        throw lastError;
      }

      if (!lastError.isRetryable) {
        throw lastError;
      }

      // DEADLINE_EXCEEDED on non-idempotent operations: don't auto-retry
      if (
        lastError instanceof KubeMQTimeoutError &&
        !IDEMPOTENT_OPERATIONS.has(ctx.operationType)
      ) {
        throw new KubeMQTimeoutError({
          message: lastError.message,
          operation: lastError.operation,
          channel: lastError.channel,
          cause: lastError.cause instanceof Error ? lastError.cause : undefined,
          statusCode: lastError.statusCode,
          serverAddress: lastError.serverAddress,
          suggestion: 'Request may have been processed by the server. Check before retrying.',
        });
      }

      // UNKNOWN status: cap at 1 retry regardless of policy
      if (lastError.statusCode === 2 && attempt >= 1) {
        throw lastError;
      }

      if (attempt >= policy.maxRetries) {
        break;
      }

      if (!throttle.tryAcquire()) {
        logger.warn('Retry throttled — concurrent retry limit reached', {
          operation: ctx.operation,
          channel: ctx.channel,
          attempt,
        });
        throw lastError;
      }

      try {
        const backoffMs = computeBackoffMs(attempt, policy);
        logger.debug('Retrying operation', {
          operation: ctx.operation,
          channel: ctx.channel,
          attempt: attempt + 1,
          maxRetries: policy.maxRetries,
          backoffMs: Math.round(backoffMs),
        });
        hooks?.onRetry?.(attempt + 1, lastError);
        await sleep(backoffMs, parentSignal);
      } finally {
        throttle.release();
      }
    }
  }

  hooks?.onExhausted?.();
  throw new RetryExhaustedError({
    message: `${ctx.operation} failed after ${String(policy.maxRetries)} retries`,
    operation: ctx.operation,
    channel: ctx.channel,
    serverAddress: ctx.serverAddress,
    cause: lastError,
    suggestion: 'Increase maxRetries or check server health.',
    attempts: policy.maxRetries,
    totalDuration: Date.now() - startTime,
    lastError: lastError ?? new Error('Unknown error'),
  });
}
