/** @internal — gRPC status → KubeMQError mapping, not part of public API */

import type { RawTransportError } from '../transport/transport.js';
import {
  type KubeMQError,
  type KubeMQErrorOptions,
  ConnectionError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  KubeMQTimeoutError,
  TransientError,
  ThrottlingError,
  NotFoundError,
  FatalError,
  CancellationError,
  ErrorCode,
} from '../../errors.js';

// ─── gRPC Status Constants (decoupled from @grpc/grpc-js) ───────────

const Status = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
} as const;

// ─── Suggestion Map ─────────────────────────────────────────────────

export const SUGGESTIONS: Readonly<Record<ErrorCode, string>> = {
  [ErrorCode.ConnectionTimeout]: 'Check server connectivity and firewall rules.',
  [ErrorCode.AuthFailed]: 'Verify your auth token is valid and not expired.',
  [ErrorCode.ValidationFailed]:
    'Check the request parameters — channel name may be empty or body missing.',
  [ErrorCode.Unavailable]: 'Server is temporarily unavailable. The SDK will retry automatically.',
  [ErrorCode.Timeout]: 'Operation timed out. Consider increasing the timeout value.',
  [ErrorCode.Throttled]: 'Server is rate-limiting requests. Reduce send rate or increase backoff.',
  [ErrorCode.NotFound]: 'The target channel or queue does not exist. Verify the channel name.',
  [ErrorCode.PermissionDenied]:
    'You do not have permission for this operation. Check your credentials and ACLs.',
  [ErrorCode.Fatal]: 'An unrecoverable server error occurred. Contact your KubeMQ administrator.',
  [ErrorCode.Cancelled]: 'The operation was cancelled.',
  [ErrorCode.BufferFull]: 'Message buffer is full. Wait for reconnection or increase buffer size.',
  [ErrorCode.StreamBroken]: 'The stream was broken. The SDK will attempt to reconnect.',
  [ErrorCode.ClientClosed]: 'The client has been closed. Create a new client instance.',
  [ErrorCode.NotImplemented]: 'This feature is not implemented in the current server version.',
  [ErrorCode.ConfigurationError]:
    'Check your client configuration — TLS certificates or connection settings may be invalid.',
  [ErrorCode.ConnectionNotReady]:
    'Connection is not ready yet. Wait for the client to connect or check server availability.',
  [ErrorCode.RetryExhausted]: 'All retry attempts have been exhausted. Check server health.',
};

// ─── Map Context ─────────────────────────────────────────────────────

export interface MapContext {
  operation: string;
  channel?: string;
  serverAddress?: string;
  localSignalAborted?: boolean;
}

// ─── mapGrpcError ────────────────────────────────────────────────────

/**
 * Map a transport-layer error to the appropriate KubeMQError subclass.
 * The original error is preserved via `cause` for debugging.
 */
export function mapGrpcError(err: RawTransportError, ctx: MapContext): KubeMQError {
  const baseOpts: KubeMQErrorOptions = {
    message: err.details || err.message,
    operation: ctx.operation,
    channel: ctx.channel,
    cause: err,
    statusCode: err.code,
    serverAddress: ctx.serverAddress,
  };

  switch (err.code) {
    case Status.OK:
      throw new Error('mapGrpcError called with OK status');

    case Status.CANCELLED:
      if (ctx.localSignalAborted) {
        return new CancellationError({
          ...baseOpts,
          suggestion: SUGGESTIONS[ErrorCode.Cancelled],
        });
      }
      return new TransientError({
        ...baseOpts,
        suggestion: 'Server cancelled the request. The SDK will retry.',
      });

    case Status.UNKNOWN:
      return new TransientError({
        ...baseOpts,
        suggestion: 'Unknown error from server or proxy. Will retry at most once.',
      });

    case Status.INVALID_ARGUMENT:
      return new ValidationError({
        ...baseOpts,
        suggestion: SUGGESTIONS[ErrorCode.ValidationFailed],
      });

    case Status.DEADLINE_EXCEEDED:
      return new KubeMQTimeoutError({
        ...baseOpts,
        suggestion: SUGGESTIONS[ErrorCode.Timeout],
      });

    case Status.NOT_FOUND:
      return new NotFoundError({
        ...baseOpts,
        suggestion: SUGGESTIONS[ErrorCode.NotFound],
      });

    case Status.ALREADY_EXISTS:
      return new ValidationError({
        ...baseOpts,
        suggestion: 'Resource already exists. Use a different name or check existing resources.',
      });

    case Status.PERMISSION_DENIED:
      return new AuthorizationError({
        ...baseOpts,
        suggestion: SUGGESTIONS[ErrorCode.PermissionDenied],
      });

    case Status.RESOURCE_EXHAUSTED:
      return new ThrottlingError({
        ...baseOpts,
        suggestion: SUGGESTIONS[ErrorCode.Throttled],
      });

    case Status.FAILED_PRECONDITION:
      return new ValidationError({
        ...baseOpts,
        suggestion: 'State precondition not met. Check the operation prerequisites.',
      });

    case Status.ABORTED:
      return new TransientError({
        ...baseOpts,
        suggestion: 'Transaction conflict. The SDK will retry.',
      });

    case Status.OUT_OF_RANGE:
      return new ValidationError({
        ...baseOpts,
        suggestion: 'Iterator or pagination boundary exceeded.',
      });

    case Status.UNIMPLEMENTED:
      return new FatalError({
        ...baseOpts,
        code: ErrorCode.NotImplemented,
        suggestion: 'This feature is not supported by the server. Check server version.',
      });

    case Status.INTERNAL: {
      // Server-side command/query timeouts arrive as INTERNAL with "timeout" in message.
      const msg = (err.details || err.message || '').toLowerCase();
      if (msg.includes('timeout') || msg.includes('deadline exceeded')) {
        return new KubeMQTimeoutError({
          ...baseOpts,
          suggestion: SUGGESTIONS[ErrorCode.Timeout],
        });
      }
      return new FatalError({
        ...baseOpts,
        suggestion: SUGGESTIONS[ErrorCode.Fatal],
      });
    }

    case Status.UNAVAILABLE:
      return new ConnectionError({
        ...baseOpts,
        code: ErrorCode.Unavailable,
        suggestion: SUGGESTIONS[ErrorCode.Unavailable],
      });

    case Status.DATA_LOSS:
      return new FatalError({
        ...baseOpts,
        suggestion: 'Unrecoverable data loss. Contact your KubeMQ administrator.',
      });

    case Status.UNAUTHENTICATED:
      return new AuthenticationError({
        ...baseOpts,
        suggestion: SUGGESTIONS[ErrorCode.AuthFailed],
      });

    default:
      return new FatalError({
        ...baseOpts,
        suggestion: `Unknown gRPC status code: ${String(err.code)}`,
      });
  }
}

// ─── Handler Error Wrapping ─────────────────────────────────────────

import { HandlerError } from '../../errors.js';

/**
 * Wrap a user-provided message handler so that exceptions are caught
 * and reported via onError instead of killing the stream.
 */
export function wrapHandler<T>(
  handler: (msg: T) => void,
  onError: (err: KubeMQError) => void,
): (msg: T) => void {
  return (msg: T) => {
    try {
      handler(msg);
    } catch (err: unknown) {
      const handlerError = new HandlerError({
        message: `Message handler threw: ${err instanceof Error ? err.message : String(err)}`,
        operation: 'messageHandler',
        cause: err instanceof Error ? err : undefined,
        suggestion: 'Fix the exception in your message handler function.',
      });
      onError(handlerError);
    }
  };
}

/**
 * Resolve the error handler: use the user-provided callback, or fall
 * back to logging at ERROR level.
 */
export function resolveErrorHandler(
  onError: ((err: KubeMQError) => void) | undefined,
  logger: { error(msg: string, fields?: Record<string, unknown>): void },
): (err: KubeMQError) => void {
  if (onError) return onError;
  return (err) => {
    logger.error('Unhandled subscription error (no onError callback registered)', {
      code: err.code,
      message: err.message,
      operation: err.operation,
      channel: err.channel,
    });
  };
}
