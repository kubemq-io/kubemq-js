import { describe, it, expect } from 'vitest';
import {
  KubeMQError,
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
  BufferFullError,
  StreamBrokenError,
  ClientClosedError,
  ConnectionNotReadyError,
  ConfigurationError,
  RetryExhaustedError,
  NotImplementedError,
  PartialFailureError,
  HandlerError,
  SenderDisconnectedError,
  SenderClosedError,
  ErrorCode,
  ErrorCategory,
} from '../../src/errors.js';

describe('KubeMQError base class', () => {
  it('populates all required fields from options', () => {
    const cause = new Error('underlying');
    const err = new KubeMQError({
      code: ErrorCode.Unavailable,
      message: 'server down',
      operation: 'sendEvent',
      channel: 'orders',
      isRetryable: true,
      cause,
      requestId: 'req-123',
      statusCode: 14,
      serverAddress: 'localhost:50000',
      suggestion: 'Check server connectivity',
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(KubeMQError);
    expect(err.code).toBe(ErrorCode.Unavailable);
    expect(err.message).toBe('server down');
    expect(err.operation).toBe('sendEvent');
    expect(err.channel).toBe('orders');
    expect(err.isRetryable).toBe(true);
    expect(err.cause).toBe(cause);
    expect(err.requestId).toBe('req-123');
    expect(err.statusCode).toBe(14);
    expect(err.serverAddress).toBe('localhost:50000');
    expect(err.suggestion).toBe('Check server connectivity');
    expect(err.timestamp).toBeInstanceOf(Date);
    expect(err.name).toBe('KubeMQError');
  });

  it('auto-generates requestId when not provided', () => {
    const err = new KubeMQError({
      code: ErrorCode.Fatal,
      message: 'test',
      operation: 'test',
      isRetryable: false,
    });
    expect(err.requestId).toBeDefined();
    expect(typeof err.requestId).toBe('string');
    expect(err.requestId.length).toBeGreaterThan(0);
  });

  it('defaults code to Fatal and isRetryable to false', () => {
    const err = new KubeMQError({
      message: 'test',
      operation: 'op',
    });
    expect(err.code).toBe(ErrorCode.Fatal);
    expect(err.isRetryable).toBe(false);
  });

  it('toJSON() returns structured representation without stack trace', () => {
    const err = new KubeMQError({
      code: ErrorCode.Fatal,
      message: 'test',
      operation: 'op',
      isRetryable: false,
    });
    const json = err.toJSON();
    expect(json).toHaveProperty('code');
    expect(json).toHaveProperty('category');
    expect(json).toHaveProperty('message');
    expect(json).toHaveProperty('timestamp');
    expect(json).not.toHaveProperty('stack');
  });

  it('toSanitizedString() includes operation and suggestion', () => {
    const err = new KubeMQError({
      code: ErrorCode.Unavailable,
      message: 'connection lost',
      operation: 'sendEvent',
      channel: 'orders',
      isRetryable: true,
      suggestion: 'Check server',
    });
    const str = err.toSanitizedString();
    expect(str).toContain('sendEvent');
    expect(str).toContain('orders');
    expect(str).toContain('Suggestion:');
  });

  it('toSanitizedString() works without channel and suggestion', () => {
    const err = new KubeMQError({
      code: ErrorCode.Fatal,
      message: 'some error',
      operation: 'connect',
    });
    const str = err.toSanitizedString();
    expect(str).toContain('connect');
    expect(str).toContain('some error');
  });
});

describe('Error hierarchy instanceof chain', () => {
  it('ConnectionError extends KubeMQError', () => {
    const err = new ConnectionError({
      code: ErrorCode.ConnectionTimeout,
      message: 'timeout',
      operation: 'connect',
      isRetryable: true,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(KubeMQError);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.name).toBe('ConnectionError');
    expect(err.isRetryable).toBe(true);
  });

  it('ConnectionNotReadyError extends ConnectionError', () => {
    const err = new ConnectionNotReadyError({
      code: ErrorCode.ConnectionNotReady,
      message: 'not ready',
      operation: 'sendEvent',
      isRetryable: false,
    });
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err).toBeInstanceOf(KubeMQError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConnectionNotReadyError');
  });

  it('KubeMQTimeoutError avoids name collision with DOM TimeoutError', () => {
    const err = new KubeMQTimeoutError({
      code: ErrorCode.Timeout,
      message: 'deadline exceeded',
      operation: 'sendCommand',
      isRetryable: true,
    });
    expect(err.name).toBe('KubeMQTimeoutError');
    expect(err).toBeInstanceOf(KubeMQError);
  });
});

describe('Error category assignment', () => {
  const cases: [string, new (opts: any) => KubeMQError, ErrorCategory][] = [
    ['ConnectionError', ConnectionError, ErrorCategory.Transient],
    ['TransientError', TransientError, ErrorCategory.Transient],
    ['KubeMQTimeoutError', KubeMQTimeoutError, ErrorCategory.Timeout],
    ['ThrottlingError', ThrottlingError, ErrorCategory.Throttling],
    ['AuthenticationError', AuthenticationError, ErrorCategory.Authentication],
    ['AuthorizationError', AuthorizationError, ErrorCategory.Authorization],
    ['ValidationError', ValidationError, ErrorCategory.Validation],
    ['NotFoundError', NotFoundError, ErrorCategory.NotFound],
    ['FatalError', FatalError, ErrorCategory.Fatal],
    ['CancellationError', CancellationError, ErrorCategory.Cancellation],
    ['BufferFullError', BufferFullError, ErrorCategory.Backpressure],
    ['ConfigurationError', ConfigurationError, ErrorCategory.Configuration],
  ];

  it.each(cases)('%s has category=%s', (_name, Ctor, expectedCategory) => {
    const err = new Ctor({
      message: 'test',
      operation: 'test',
    });
    expect(err.category).toBe(expectedCategory);
  });
});

describe('Error cause chain (ES2022)', () => {
  it('preserves cause via Error.cause', () => {
    const grpcErr = new Error('14 UNAVAILABLE: connect ECONNREFUSED');
    const sdkErr = new ConnectionError({
      code: ErrorCode.Unavailable,
      message: 'connection lost',
      operation: 'sendEvent',
      channel: 'orders',
      isRetryable: true,
      cause: grpcErr,
    });
    expect(sdkErr.cause).toBe(grpcErr);
    expect((sdkErr.cause as Error).message).toBe('14 UNAVAILABLE: connect ECONNREFUSED');
  });
});

describe('Symbol.hasInstance cross-version safety', () => {
  it('KubeMQError[Symbol.hasInstance] works on instances', () => {
    const err = new KubeMQError({
      message: 'test',
      operation: 'test',
    });
    expect(err instanceof KubeMQError).toBe(true);
  });

  it('KubeMQError[Symbol.hasInstance] rejects non-instances', () => {
    expect(new Error('plain') instanceof KubeMQError).toBe(false);
    expect({} instanceof KubeMQError).toBe(false);
    expect((null as unknown) instanceof KubeMQError).toBe(false);
  });
});

describe('StreamBrokenError', () => {
  it('carries unacknowledgedMessageIds', () => {
    const err = new StreamBrokenError({
      message: 'broken',
      operation: 'stream',
      unacknowledgedMessageIds: ['msg-1', 'msg-2'],
    });
    expect(err.unacknowledgedMessageIds).toEqual(['msg-1', 'msg-2']);
    expect(err.name).toBe('StreamBrokenError');
    expect(err.isRetryable).toBe(true);
  });
});

describe('RetryExhaustedError', () => {
  it('carries retry metadata', () => {
    const lastErr = new TransientError({
      message: 'unavailable',
      operation: 'send',
    });
    const err = new RetryExhaustedError({
      message: 'exhausted',
      operation: 'sendEvent',
      attempts: 3,
      totalDuration: 1500,
      lastError: lastErr,
    });
    expect(err.attempts).toBe(3);
    expect(err.totalDuration).toBe(1500);
    expect(err.lastError).toBe(lastErr);
    expect(err.name).toBe('RetryExhaustedError');
    expect(err.isRetryable).toBe(false);
  });

  it('toSanitizedString() includes retry metadata', () => {
    const err = new RetryExhaustedError({
      message: 'failed',
      operation: 'send',
      attempts: 3,
      totalDuration: 2000,
      lastError: new Error('last'),
    });
    const str = err.toSanitizedString();
    expect(str).toContain('Retries exhausted');
    expect(str).toContain('3');
    expect(str).toContain('2000');
  });
});

describe('PartialFailureError', () => {
  it('carries failures array', () => {
    const childErr = new ValidationError({
      message: 'invalid',
      operation: 'batch',
    });
    const err = new PartialFailureError({
      message: 'partial',
      operation: 'batchSend',
      failures: [{ index: 2, error: childErr }],
    });
    expect(err.failures).toHaveLength(1);
    expect(err.failures[0]!.index).toBe(2);
    expect(err.failures[0]!.error).toBe(childErr);
    expect(err.name).toBe('PartialFailureError');
  });
});

describe('HandlerError', () => {
  it('wraps user handler exceptions', () => {
    const err = new HandlerError({
      message: 'handler threw',
      operation: 'messageHandler',
    });
    expect(err.name).toBe('HandlerError');
    expect(err.category).toBe(ErrorCategory.Fatal);
    expect(err.isRetryable).toBe(false);
  });
});

describe('NotImplementedError', () => {
  it('is fatal and not retryable', () => {
    const err = new NotImplementedError({
      message: 'not impl',
      operation: 'featureX',
    });
    expect(err.name).toBe('NotImplementedError');
    expect(err.category).toBe(ErrorCategory.Fatal);
    expect(err.isRetryable).toBe(false);
  });
});

describe('ClientClosedError', () => {
  it('is fatal and not retryable', () => {
    const err = new ClientClosedError({
      message: 'closed',
      operation: 'sendEvent',
    });
    expect(err.name).toBe('ClientClosedError');
    expect(err.category).toBe(ErrorCategory.Fatal);
    expect(err.isRetryable).toBe(false);
  });
});

describe('SenderDisconnectedError', () => {
  it('has correct defaults', () => {
    const err = new SenderDisconnectedError({
      message: 'disconnected',
      operation: 'send',
    });
    expect(err.name).toBe('SenderDisconnectedError');
    expect(err.isRetryable).toBe(true);
    expect(err).toBeInstanceOf(KubeMQError);
  });

  it('accepts custom code and isRetryable', () => {
    const err = new SenderDisconnectedError({
      message: 'custom',
      operation: 'send',
      isRetryable: false,
    });
    expect(err.isRetryable).toBe(false);
  });
});

describe('SenderClosedError', () => {
  it('has correct defaults', () => {
    const err = new SenderClosedError({
      message: 'closed',
      operation: 'send',
    });
    expect(err.name).toBe('SenderClosedError');
    expect(err.isRetryable).toBe(false);
    expect(err).toBeInstanceOf(KubeMQError);
  });

  it('accepts custom code and isRetryable', () => {
    const err = new SenderClosedError({
      message: 'custom',
      operation: 'send',
      isRetryable: true,
    });
    expect(err.isRetryable).toBe(true);
  });
});
