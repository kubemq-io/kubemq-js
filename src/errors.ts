import { randomUUID } from 'node:crypto';

// ─── Error Codes ─────────────────────────────────────────────────────

/**
 * Machine-readable error codes identifying the specific failure condition.
 *
 * @remarks
 * Every {@link KubeMQError} carries an `ErrorCode`. Use these constants in
 * `switch` / `if` checks rather than comparing error message strings.
 *
 * @see {@link KubeMQError.code}
 * @see {@link ErrorCategory}
 */
export const ErrorCode = {
  /** The initial connection or a reconnection attempt timed out. */
  ConnectionTimeout: 'CONNECTION_TIMEOUT',
  /** Authentication credentials were rejected by the server. */
  AuthFailed: 'AUTH_FAILED',
  /** A message or request failed input validation before being sent. */
  ValidationFailed: 'VALIDATION_FAILED',
  /** The server is temporarily unavailable (transient). */
  Unavailable: 'UNAVAILABLE',
  /** An operation exceeded its deadline. */
  Timeout: 'TIMEOUT',
  /** The server throttled the request due to rate limiting. */
  Throttled: 'THROTTLED',
  /** The requested channel or resource does not exist. */
  NotFound: 'NOT_FOUND',
  /** The authenticated identity lacks permission for this operation. */
  PermissionDenied: 'PERMISSION_DENIED',
  /** An unrecoverable internal error. */
  Fatal: 'FATAL',
  /** The operation was cancelled via `AbortSignal`. */
  Cancelled: 'CANCELLED',
  /** The reconnect buffer is full and cannot accept more messages. */
  BufferFull: 'BUFFER_FULL',
  /** A streaming connection broke mid-flight. */
  StreamBroken: 'STREAM_BROKEN',
  /** The client has been closed; no further operations are allowed. */
  ClientClosed: 'CLIENT_CLOSED',
  /** The requested feature is not implemented in this SDK version. */
  NotImplemented: 'NOT_IMPLEMENTED',
  /** A client configuration value is invalid. */
  ConfigurationError: 'CONFIGURATION_ERROR',
  /** The transport connection is not in a ready state. */
  ConnectionNotReady: 'CONNECTION_NOT_READY',
  /** All retry attempts have been exhausted. */
  RetryExhausted: 'RETRY_EXHAUSTED',
} as const;

/** @see {@link ErrorCode} */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ─── Error Categories ────────────────────────────────────────────────

/**
 * Broad error categories for high-level error handling strategies.
 *
 * @remarks
 * While {@link ErrorCode} identifies the specific failure, `ErrorCategory`
 * groups errors by recovery strategy:
 * - **Transient / Timeout / Throttling** — safe to retry with backoff.
 * - **Authentication / Authorization** — fix credentials or permissions.
 * - **Validation / Configuration** — fix the input or config, then retry.
 * - **Fatal / Cancellation** — not recoverable by retry.
 * - **Backpressure** — slow down or increase buffer capacity.
 * - **NotFound** — the target channel or resource doesn't exist.
 *
 * @see {@link KubeMQError.category}
 * @see {@link ErrorCode}
 */
export const ErrorCategory = {
  /** A temporary failure that may self-resolve (e.g. network blip). */
  Transient: 'Transient',
  /** An operation exceeded its deadline. */
  Timeout: 'Timeout',
  /** The server is rate-limiting the client. */
  Throttling: 'Throttling',
  /** Credentials are invalid or expired. */
  Authentication: 'Authentication',
  /** The identity lacks required permissions. */
  Authorization: 'Authorization',
  /** Input did not pass validation rules. */
  Validation: 'Validation',
  /** The target resource was not found. */
  NotFound: 'NotFound',
  /** Unrecoverable failure. */
  Fatal: 'Fatal',
  /** The operation was explicitly cancelled. */
  Cancellation: 'Cancellation',
  /** The system is applying backpressure (buffer full). */
  Backpressure: 'Backpressure',
  /** A configuration parameter is invalid. */
  Configuration: 'Configuration',
} as const;

/** @see {@link ErrorCategory} */
export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

// ─── Options Interfaces ─────────────────────────────────────────────

/**
 * Construction options shared by all {@link KubeMQError} subclasses.
 *
 * @see {@link KubeMQError}
 */
export interface KubeMQErrorOptions {
  /** Machine-readable error code. Defaults to {@link ErrorCode.Fatal}. */
  code?: ErrorCode;
  /** Human-readable error description. */
  message: string;
  /** The SDK operation that failed (e.g. `'publishEvent'`). */
  operation: string;
  /** The channel involved, if any. */
  channel?: string;
  /** Whether the operation is safe to retry. */
  isRetryable?: boolean;
  /** The underlying cause, if this error wraps another. */
  cause?: Error;
  /** Correlation ID for tracing. Auto-generated UUID if omitted. */
  requestId?: string;
  /** gRPC status code, when the error originates from the server. */
  statusCode?: number;
  /** Address of the KubeMQ server that returned the error. */
  serverAddress?: string;
  /** Actionable suggestion for resolving the error. */
  suggestion?: string;
  /** Number of retry attempts made before this error was raised. */
  retryAttempts?: number;
  /** Maximum retries configured in the active {@link RetryPolicy}. */
  maxRetries?: number;
  /** Total wall-clock time spent retrying, in milliseconds. */
  retryDuration?: number;
}

/**
 * Construction options for {@link StreamBrokenError}.
 *
 * @see {@link StreamBrokenError}
 */
export interface StreamBrokenErrorOptions extends KubeMQErrorOptions {
  /** IDs of messages that were sent but not acknowledged before the stream broke. */
  unacknowledgedMessageIds: string[];
}

/**
 * Construction options for {@link RetryExhaustedError}.
 *
 * @see {@link RetryExhaustedError}
 */
export interface RetryExhaustedErrorOptions extends KubeMQErrorOptions {
  /** Total number of attempts made (initial + retries). */
  attempts: number;
  /** Total wall-clock time spent across all retry attempts, in milliseconds. */
  totalDuration: number;
  /** The error from the final failed attempt. */
  lastError: Error;
}

/**
 * Construction options for {@link PartialFailureError}.
 *
 * @see {@link PartialFailureError}
 */
export interface PartialFailureErrorOptions extends KubeMQErrorOptions {
  /** Per-item failures with their batch index and error. */
  failures: { index: number; error: KubeMQError }[];
}

// ─── Symbol for cross-version instanceof safety ─────────────────────

const KUBEMQ_ERROR_SYMBOL = Symbol.for('kubemq.error');

// ─── Base Error Class ───────────────────────────────────────────────

/**
 * Base error class for all KubeMQ SDK errors.
 *
 * @remarks
 * All errors thrown by the SDK are instances of `KubeMQError` (or a subclass).
 * Use `instanceof KubeMQError` for broad catches, or check specific subclasses
 * for targeted handling. Cross-version `instanceof` safety is provided via
 * `Symbol.hasInstance`.
 *
 * Key properties for error handling:
 * - {@link KubeMQError.code | code} — machine-readable {@link ErrorCode}
 * - {@link KubeMQError.category | category} — broad {@link ErrorCategory} for strategy selection
 * - {@link KubeMQError.isRetryable | isRetryable} — whether automatic retry is appropriate
 * - {@link KubeMQError.suggestion | suggestion} — actionable fix hint
 *
 * @see {@link ErrorCode}
 * @see {@link ErrorCategory}
 */
export class KubeMQError extends Error {
  /**
   * Cross-version instanceof check via well-known symbol.
   * Only used on the base class — subclass discrimination uses the
   * standard prototype chain (preserved by Object.setPrototypeOf).
   */
  static override [Symbol.hasInstance](instance: unknown): boolean {
    if (
      typeof instance !== 'object' ||
      instance === null ||
      !(instance as Record<symbol, unknown>)[KUBEMQ_ERROR_SYMBOL]
    ) {
      return false;
    }
    if (this === KubeMQError) return true;
    return Function.prototype[Symbol.hasInstance].call(this, instance);
  }

  override name: string;
  readonly code: ErrorCode;
  readonly operation: string;
  readonly channel: string | undefined;
  readonly isRetryable: boolean;
  readonly requestId: string;
  readonly statusCode: number | undefined;
  readonly serverAddress: string | undefined;
  readonly timestamp: Date;
  readonly category: ErrorCategory;
  readonly suggestion: string | undefined;

  constructor(options: KubeMQErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'KubeMQError';
    this.code = options.code ?? ErrorCode.Fatal;
    this.operation = options.operation;
    this.channel = options.channel;
    this.isRetryable = options.isRetryable ?? false;
    this.requestId = options.requestId ?? randomUUID();
    this.statusCode = options.statusCode;
    this.serverAddress = options.serverAddress;
    this.timestamp = new Date();
    this.category = ErrorCategory.Fatal;
    this.suggestion = options.suggestion;
    Object.setPrototypeOf(this, new.target.prototype);
    Object.defineProperty(this, KUBEMQ_ERROR_SYMBOL, { value: true });
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      operation: this.operation,
      channel: this.channel,
      isRetryable: this.isRetryable,
      requestId: this.requestId,
      statusCode: this.statusCode,
      serverAddress: this.serverAddress,
      timestamp: this.timestamp.toISOString(),
      suggestion: this.suggestion,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    };
  }

  toSanitizedString(): string {
    const parts = [
      `${this.operation} failed`,
      this.channel ? `on channel "${this.channel}"` : undefined,
      `: ${this.message}`,
    ]
      .filter(Boolean)
      .join(' ');

    const lines = [parts];
    if (this.suggestion) {
      lines.push(`  Suggestion: ${this.suggestion}`);
    }
    return lines.join('\n');
  }
}

// ─── Error Subclasses ───────────────────────────────────────────────

/**
 * Thrown when the SDK cannot establish or maintain a connection to the server.
 *
 * @remarks
 * Retryable by default. The reconnection policy handles automatic recovery;
 * this error surfaces only if reconnection is disabled or exhausted.
 *
 * @see {@link KubeMQError}
 * @see {@link ConnectionNotReadyError}
 */
export class ConnectionError extends KubeMQError {
  override readonly category = ErrorCategory.Transient;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.ConnectionTimeout,
      isRetryable: options.isRetryable ?? true,
    });
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the server rejects the provided authentication credentials.
 *
 * @remarks
 * Not retryable. Verify the token or {@link CredentialProvider} configuration.
 *
 * @see {@link KubeMQError}
 * @see {@link AuthorizationError}
 */
export class AuthenticationError extends KubeMQError {
  override readonly category = ErrorCategory.Authentication;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.AuthFailed,
      isRetryable: false,
    });
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the authenticated identity lacks permission for the requested operation.
 *
 * @remarks
 * Not retryable. The credentials are valid but the associated role/policy
 * does not grant access to the target channel or operation.
 *
 * @see {@link KubeMQError}
 * @see {@link AuthenticationError}
 */
export class AuthorizationError extends KubeMQError {
  override readonly category = ErrorCategory.Authorization;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.PermissionDenied,
      isRetryable: false,
    });
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an operation exceeds its configured timeout.
 *
 * @remarks
 * Retryable by default. Consider increasing the timeout via
 * {@link OperationOptions.timeout} or the relevant default in {@link ClientOptions}.
 *
 * @see {@link KubeMQError}
 */
export class KubeMQTimeoutError extends KubeMQError {
  override readonly category = ErrorCategory.Timeout;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.Timeout,
      isRetryable: options.isRetryable ?? true,
    });
    this.name = 'KubeMQTimeoutError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a message or request fails client-side validation before sending.
 *
 * @remarks
 * Not retryable. Fix the invalid input (e.g. empty channel name, missing body)
 * and re-submit. The `suggestion` property usually indicates what to fix.
 *
 * @see {@link KubeMQError}
 */
export class ValidationError extends KubeMQError {
  override readonly category = ErrorCategory.Validation;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.ValidationFailed,
      isRetryable: false,
    });
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown for temporary server-side failures that are expected to self-resolve.
 *
 * @remarks
 * Retryable by default. The SDK's built-in retry policy handles these
 * automatically; this error surfaces only when retries are exhausted.
 *
 * @see {@link KubeMQError}
 * @see {@link RetryPolicy}
 */
export class TransientError extends KubeMQError {
  override readonly category = ErrorCategory.Transient;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.Unavailable,
      isRetryable: options.isRetryable ?? true,
    });
    this.name = 'TransientError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the server rate-limits the client.
 *
 * @remarks
 * Retryable by default with backoff. Reduce request rate or increase
 * server-side rate limits.
 *
 * @see {@link KubeMQError}
 */
export class ThrottlingError extends KubeMQError {
  override readonly category = ErrorCategory.Throttling;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.Throttled,
      isRetryable: options.isRetryable ?? true,
    });
    this.name = 'ThrottlingError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the target channel or resource does not exist on the server.
 *
 * @remarks
 * Not retryable. Create the channel first via
 * {@link KubeMQClient.createChannel} or one of the convenience aliases.
 *
 * @see {@link KubeMQError}
 */
export class NotFoundError extends KubeMQError {
  override readonly category = ErrorCategory.NotFound;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.NotFound,
      isRetryable: false,
    });
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown for unrecoverable internal failures.
 *
 * @remarks
 * Not retryable by default. Indicates a server-side or SDK-internal bug.
 * Report to the KubeMQ team if recurring.
 *
 * @see {@link KubeMQError}
 */
export class FatalError extends KubeMQError {
  override readonly category = ErrorCategory.Fatal;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.Fatal,
      isRetryable: options.isRetryable ?? false,
    });
    this.name = 'FatalError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an operation is cancelled via `AbortSignal`.
 *
 * @remarks
 * Not retryable. This is the expected error when cooperative cancellation
 * is triggered by the caller through {@link OperationOptions.signal}.
 *
 * @see {@link KubeMQError}
 */
export class CancellationError extends KubeMQError {
  override readonly category = ErrorCategory.Cancellation;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.Cancelled,
      isRetryable: false,
    });
    this.name = 'CancellationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the reconnect buffer is full and cannot accept more messages.
 *
 * @remarks
 * Not retryable. Increase {@link ClientOptions.reconnectBufferSize} or
 * switch `reconnectBufferMode` to `'block'` for flow control.
 *
 * @see {@link KubeMQError}
 * @see {@link ClientOptions.reconnectBufferSize}
 */
export class BufferFullError extends KubeMQError {
  override readonly category = ErrorCategory.Backpressure;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.BufferFull,
      isRetryable: false,
    });
    this.name = 'BufferFullError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a streaming connection (subscription or queue stream) breaks mid-flight.
 *
 * @remarks
 * Retryable by default. Carries `unacknowledgedMessageIds` — the IDs of messages
 * that were sent but not yet acknowledged at the time the stream broke.
 * Application code should decide whether to re-send or deduplicate these messages.
 *
 * @see {@link KubeMQError}
 * @see {@link StreamBrokenErrorOptions}
 */
export class StreamBrokenError extends KubeMQError {
  override readonly category = ErrorCategory.Transient;
  readonly unacknowledgedMessageIds: string[];

  constructor(options: StreamBrokenErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.StreamBroken,
      isRetryable: options.isRetryable ?? true,
    });
    this.name = 'StreamBrokenError';
    this.unacknowledgedMessageIds = options.unacknowledgedMessageIds;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an operation is attempted on a client that has already been closed.
 *
 * @remarks
 * Not retryable. Create a new {@link KubeMQClient} instance if further
 * operations are needed.
 *
 * @see {@link KubeMQError}
 * @see {@link KubeMQClient.close}
 */
export class ClientClosedError extends KubeMQError {
  override readonly category = ErrorCategory.Fatal;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.ClientClosed,
      isRetryable: false,
    });
    this.name = 'ClientClosedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an operation is attempted before the transport connection is ready.
 *
 * @remarks
 * Not retryable by default. Usually indicates the client is still connecting
 * or in the process of reconnecting. Wait for the `'connected'` or
 * `'reconnected'` event before retrying.
 *
 * @see {@link ConnectionError}
 * @see {@link ConnectionState}
 */
export class ConnectionNotReadyError extends ConnectionError {
  override readonly category = ErrorCategory.Transient;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.ConnectionNotReady,
      isRetryable: options.isRetryable ?? false,
    });
    this.name = 'ConnectionNotReadyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when {@link ClientOptions} contain invalid or conflicting values.
 *
 * @remarks
 * Not retryable. Fix the configuration and create a new client.
 *
 * @see {@link KubeMQError}
 * @see {@link ClientOptions}
 */
export class ConfigurationError extends KubeMQError {
  override readonly category = ErrorCategory.Configuration;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.ConfigurationError,
      isRetryable: false,
    });
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when all retry attempts for an operation have been exhausted.
 *
 * @remarks
 * Not retryable. Carries detailed retry diagnostics: `attempts`, `totalDuration`,
 * and `lastError` (the error from the final attempt). Consider increasing
 * {@link RetryPolicy.maxRetries} or investigating the root cause via `lastError`.
 *
 * @see {@link KubeMQError}
 * @see {@link RetryPolicy}
 * @see {@link RetryExhaustedErrorOptions}
 */
export class RetryExhaustedError extends KubeMQError {
  readonly attempts: number;
  readonly maxRetries: number;
  readonly totalDuration: number;
  readonly lastError: Error;

  constructor(options: RetryExhaustedErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.RetryExhausted,
      isRetryable: false,
    });
    this.name = 'RetryExhaustedError';
    this.attempts = options.attempts;
    this.maxRetries = options.maxRetries ?? options.attempts;
    this.totalDuration = options.totalDuration;
    this.lastError = options.lastError;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  override toSanitizedString(): string {
    const base = super.toSanitizedString();
    return `${base}\n  Retries exhausted: ${String(this.attempts)}/${String(this.maxRetries)} attempts over ${String(this.totalDuration)}ms`;
  }
}

/**
 * Thrown when a requested feature is not implemented in this SDK version.
 *
 * @remarks
 * Not retryable. Check the SDK release notes for feature availability
 * or use an alternative API surface.
 *
 * @see {@link KubeMQError}
 */
export class NotImplementedError extends KubeMQError {
  override readonly category = ErrorCategory.Fatal;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.NotImplemented,
      isRetryable: false,
    });
    this.name = 'NotImplementedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a batch operation partially succeeds — some items failed while others succeeded.
 *
 * @remarks
 * Inspect the {@link PartialFailureError.failures | failures} array for per-item
 * error details including the batch `index` and the associated {@link KubeMQError}.
 *
 * @see {@link KubeMQError}
 * @see {@link PartialFailureErrorOptions}
 * @see {@link KubeMQClient.sendQueueMessagesBatch}
 */
export class PartialFailureError extends KubeMQError {
  readonly failures: { index: number; error: KubeMQError }[];

  constructor(options: PartialFailureErrorOptions) {
    super(options);
    this.name = 'PartialFailureError';
    this.failures = options.failures;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a user-provided callback or handler throws an unhandled error.
 *
 * @remarks
 * Not retryable by default. Wraps the original error thrown by the user's
 * subscription callback or event handler. Fix the handler code to prevent
 * unhandled exceptions.
 *
 * @see {@link KubeMQError}
 */
export class HandlerError extends KubeMQError {
  override readonly category = ErrorCategory.Fatal;

  constructor(options: KubeMQErrorOptions) {
    super({
      ...options,
      code: options.code ?? ErrorCode.Fatal,
      isRetryable: options.isRetryable ?? false,
    });
    this.name = 'HandlerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
