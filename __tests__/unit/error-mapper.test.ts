import { describe, it, expect } from 'vitest';
import { mapGrpcError } from '../../src/internal/middleware/error-mapper.js';
import {
  KubeMQError,
  TransientError,
  ValidationError,
  KubeMQTimeoutError,
  NotFoundError,
  AuthorizationError,
  ThrottlingError,
  FatalError,
  AuthenticationError,
  CancellationError,
  ConnectionError,
} from '../../src/errors.js';
import { makeTransportError, GrpcStatus } from '../fixtures/grpc-mocks.js';

describe('mapGrpcError — all gRPC status codes', () => {
  const ctx = { operation: 'test', channel: 'ch', serverAddress: 'localhost:50000' };

  const mappings: [number, string, new (...args: any[]) => KubeMQError, boolean][] = [
    [GrpcStatus.CANCELLED, 'CANCELLED (local)', CancellationError, false],
    [GrpcStatus.UNKNOWN, 'UNKNOWN', TransientError, true],
    [GrpcStatus.INVALID_ARGUMENT, 'INVALID_ARGUMENT', ValidationError, false],
    [GrpcStatus.DEADLINE_EXCEEDED, 'DEADLINE_EXCEEDED', KubeMQTimeoutError, true],
    [GrpcStatus.NOT_FOUND, 'NOT_FOUND', NotFoundError, false],
    [GrpcStatus.ALREADY_EXISTS, 'ALREADY_EXISTS', ValidationError, false],
    [GrpcStatus.PERMISSION_DENIED, 'PERMISSION_DENIED', AuthorizationError, false],
    [GrpcStatus.RESOURCE_EXHAUSTED, 'RESOURCE_EXHAUSTED', ThrottlingError, true],
    [GrpcStatus.FAILED_PRECONDITION, 'FAILED_PRECONDITION', ValidationError, false],
    [GrpcStatus.ABORTED, 'ABORTED', TransientError, true],
    [GrpcStatus.OUT_OF_RANGE, 'OUT_OF_RANGE', ValidationError, false],
    [GrpcStatus.UNIMPLEMENTED, 'UNIMPLEMENTED', FatalError, false],
    [GrpcStatus.INTERNAL, 'INTERNAL', FatalError, false],
    [GrpcStatus.UNAVAILABLE, 'UNAVAILABLE', ConnectionError, true],
    [GrpcStatus.DATA_LOSS, 'DATA_LOSS', FatalError, false],
    [GrpcStatus.UNAUTHENTICATED, 'UNAUTHENTICATED', AuthenticationError, false],
  ];

  it.each(mappings)(
    'gRPC %d (%s) → expected error class (retryable=%s)',
    (code, _name, ExpectedClass, expectedRetryable) => {
      const transportErr = makeTransportError(code);
      const localAborted = code === GrpcStatus.CANCELLED;
      const sdkErr = mapGrpcError(transportErr, { ...ctx, localSignalAborted: localAborted });
      expect(sdkErr).toBeInstanceOf(ExpectedClass);
      expect(sdkErr).toBeInstanceOf(KubeMQError);
      expect(sdkErr.isRetryable).toBe(expectedRetryable);
      expect(sdkErr.cause).toBe(transportErr);
      expect(sdkErr.statusCode).toBe(code);
    },
  );

  it('CANCELLED + localSignalAborted=true → CancellationError', () => {
    const err = mapGrpcError(makeTransportError(GrpcStatus.CANCELLED), {
      ...ctx,
      localSignalAborted: true,
    });
    expect(err).toBeInstanceOf(CancellationError);
    expect(err.isRetryable).toBe(false);
  });

  it('CANCELLED + localSignalAborted=false → TransientError (server-initiated)', () => {
    const err = mapGrpcError(makeTransportError(GrpcStatus.CANCELLED), {
      ...ctx,
      localSignalAborted: false,
    });
    expect(err).toBeInstanceOf(TransientError);
    expect(err.isRetryable).toBe(true);
  });

  it('preserves original error as cause', () => {
    const transportErr = makeTransportError(GrpcStatus.UNAVAILABLE, 'connect refused');
    const sdkErr = mapGrpcError(transportErr, ctx);
    expect(sdkErr.cause).toBe(transportErr);
    expect(sdkErr.message).toBe('connect refused');
  });

  it('includes suggestion on every mapped error', () => {
    for (const [code] of mappings) {
      if (code === GrpcStatus.OK) continue;
      const localAborted = code === GrpcStatus.CANCELLED;
      const sdkErr = mapGrpcError(makeTransportError(code), {
        ...ctx,
        localSignalAborted: localAborted,
      });
      expect(sdkErr.suggestion).toBeDefined();
      expect(sdkErr.suggestion!.length).toBeGreaterThan(0);
    }
  });

  it('includes operation and channel from context', () => {
    const err = mapGrpcError(makeTransportError(GrpcStatus.INTERNAL), {
      operation: 'sendEvent',
      channel: 'orders',
      serverAddress: 'host:50000',
    });
    expect(err.operation).toBe('sendEvent');
    expect(err.channel).toBe('orders');
    expect(err.serverAddress).toBe('host:50000');
  });

  it('throws on OK status', () => {
    expect(() => mapGrpcError(makeTransportError(GrpcStatus.OK), ctx)).toThrow(
      'mapGrpcError called with OK status',
    );
  });

  it('unknown gRPC status code → FatalError with code in suggestion', () => {
    const unknownCode = 999;
    const err = mapGrpcError(makeTransportError(unknownCode), ctx);
    expect(err).toBeInstanceOf(FatalError);
    expect(err.isRetryable).toBe(false);
    expect(err.suggestion).toContain('Unknown gRPC status code');
    expect(err.suggestion).toContain('999');
  });
});
