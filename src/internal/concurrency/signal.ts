import { CancellationError, KubeMQTimeoutError, ErrorCode } from '../../errors.js';

/**
 * Compose an effective AbortSignal from operation options and a default timeout.
 *
 * Priority:
 * 1. Both signal and timeout → `AbortSignal.any([signal, AbortSignal.timeout(timeout)])`
 * 2. Only signal → use as-is
 * 3. Only timeout → `AbortSignal.timeout(timeout)`
 * 4. Neither → `AbortSignal.timeout(defaultTimeoutMs)`
 */
export function resolveSignal(
  defaultTimeoutMs: number,
  opts?: { signal?: AbortSignal; timeout?: number },
): AbortSignal {
  const userSignal = opts?.signal;
  const timeoutMs = opts?.timeout;

  if (userSignal && timeoutMs !== undefined) {
    return AbortSignal.any([userSignal, AbortSignal.timeout(timeoutMs)]);
  }
  if (userSignal) {
    return userSignal;
  }
  if (timeoutMs !== undefined) {
    return AbortSignal.timeout(timeoutMs);
  }
  return AbortSignal.timeout(defaultTimeoutMs);
}

/**
 * Map an AbortSignal abort reason to the appropriate SDK error.
 *
 * - `DOMException` with name `TimeoutError` → `KubeMQTimeoutError` (retryable)
 * - Everything else → `CancellationError` (non-retryable)
 */
export function mapAbortReason(
  reason: unknown,
  operation: string,
  channel?: string,
): CancellationError | KubeMQTimeoutError {
  if (reason instanceof DOMException && reason.name === 'TimeoutError') {
    return new KubeMQTimeoutError({
      code: ErrorCode.Timeout,
      message: 'Operation timed out',
      operation,
      channel,
      isRetryable: true,
      cause: reason,
      suggestion: 'Increase the timeout value or check server health.',
    });
  }

  return new CancellationError({
    code: ErrorCode.Cancelled,
    message: 'Operation was cancelled',
    operation,
    channel,
    isRetryable: false,
    cause: reason instanceof Error ? reason : undefined,
    suggestion: 'The operation was cancelled via AbortSignal.',
  });
}

/**
 * Throw the appropriate SDK error if the signal is already aborted.
 * Call before starting any operation to fail fast on pre-aborted signals.
 */
export function throwIfAborted(signal: AbortSignal, operation: string, channel?: string): void {
  if (signal.aborted) {
    throw mapAbortReason(signal.reason, operation, channel);
  }
}
