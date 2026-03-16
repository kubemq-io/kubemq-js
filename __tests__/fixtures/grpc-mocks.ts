import type { RawTransportError } from '../../src/internal/transport/transport.js';

/**
 * Creates a mock RawTransportError that mimics gRPC ServiceError shape.
 * Used by error-mapper tests to avoid depending on @grpc/grpc-js directly.
 */
export function makeTransportError(code: number, details = 'test detail'): RawTransportError {
  const err = new Error(details) as RawTransportError;
  err.code = code;
  err.details = details;
  err.metadata = {};
  return err;
}

/** gRPC status codes, duplicated here to avoid @grpc/grpc-js import in tests */
export const GrpcStatus = {
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
