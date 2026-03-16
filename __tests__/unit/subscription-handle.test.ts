import { describe, it, expect, vi } from 'vitest';
import { GrpcSubscriptionHandle } from '../../src/internal/transport/subscription-handle.js';
import type { StreamHandle } from '../../src/internal/transport/transport.js';
import { noopLogger } from '../../src/logger.js';

function createMockStream(): StreamHandle<never, unknown> & {
  triggerEnd: () => void;
  triggerError: () => void;
} {
  let endHandler: (() => void) | undefined;
  let errorHandler: (() => void) | undefined;
  return {
    write: vi.fn(() => false),
    onData: vi.fn(),
    onError: vi.fn((handler: (err: Error) => void) => {
      errorHandler = handler;
    }),
    onEnd: vi.fn((handler: () => void) => {
      endHandler = handler;
    }),
    cancel: vi.fn(),
    end: vi.fn(),
    triggerEnd() {
      endHandler?.();
    },
    triggerError() {
      errorHandler?.();
    },
  };
}

describe('GrpcSubscriptionHandle', () => {
  it('is active after construction', () => {
    const stream = createMockStream();
    const handle = new GrpcSubscriptionHandle(stream, noopLogger, 'subscribeEvents');
    expect(handle.isActive).toBe(true);
  });

  it('attaches lifecycle listeners on construction', () => {
    const stream = createMockStream();
    new GrpcSubscriptionHandle(stream, noopLogger, 'subscribeEvents');
    expect(stream.onEnd).toHaveBeenCalledOnce();
    expect(stream.onError).toHaveBeenCalledOnce();
  });

  it('cancel sets isActive to false', () => {
    const stream = createMockStream();
    const handle = new GrpcSubscriptionHandle(stream, noopLogger, 'subscribeEvents');
    handle.cancel();
    expect(handle.isActive).toBe(false);
  });

  it('cancel calls stream.cancel', () => {
    const stream = createMockStream();
    const handle = new GrpcSubscriptionHandle(stream, noopLogger, 'subscribeEvents');
    handle.cancel();
    expect(stream.cancel).toHaveBeenCalledOnce();
  });

  it('cancel is idempotent (second call is no-op)', () => {
    const stream = createMockStream();
    const handle = new GrpcSubscriptionHandle(stream, noopLogger, 'subscribeEvents');
    handle.cancel();
    handle.cancel();
    expect(stream.cancel).toHaveBeenCalledOnce();
  });

  it('stream end event sets isActive to false', () => {
    const stream = createMockStream();
    const handle = new GrpcSubscriptionHandle(stream, noopLogger, 'subscribeEvents');
    stream.triggerEnd();
    expect(handle.isActive).toBe(false);
  });

  it('stream error event sets isActive to false', () => {
    const stream = createMockStream();
    const handle = new GrpcSubscriptionHandle(stream, noopLogger, 'subscribeEvents');
    stream.triggerError();
    expect(handle.isActive).toBe(false);
  });

  it('rebind cancels old stream', () => {
    const oldStream = createMockStream();
    const newStream = createMockStream();
    const handle = new GrpcSubscriptionHandle(oldStream, noopLogger, 'subscribeEvents');
    handle.rebind(newStream);
    expect(oldStream.cancel).toHaveBeenCalledOnce();
  });

  it('rebind sets isActive back to true', () => {
    const oldStream = createMockStream();
    const handle = new GrpcSubscriptionHandle(oldStream, noopLogger, 'subscribeEvents');
    handle.cancel();
    expect(handle.isActive).toBe(false);

    const newStream = createMockStream();
    handle.rebind(newStream);
    expect(handle.isActive).toBe(true);
  });

  it('rebind attaches lifecycle listeners to new stream', () => {
    const oldStream = createMockStream();
    const newStream = createMockStream();
    const handle = new GrpcSubscriptionHandle(oldStream, noopLogger, 'subscribeEvents');
    handle.rebind(newStream);
    expect(newStream.onEnd).toHaveBeenCalledOnce();
    expect(newStream.onError).toHaveBeenCalledOnce();
  });

  it('after rebind, new stream end sets isActive to false', () => {
    const oldStream = createMockStream();
    const newStream = createMockStream();
    const handle = new GrpcSubscriptionHandle(oldStream, noopLogger, 'subscribeEvents');
    handle.rebind(newStream);
    expect(handle.isActive).toBe(true);
    newStream.triggerEnd();
    expect(handle.isActive).toBe(false);
  });

  it('after rebind, new stream error sets isActive to false', () => {
    const oldStream = createMockStream();
    const newStream = createMockStream();
    const handle = new GrpcSubscriptionHandle(oldStream, noopLogger, 'subscribeEvents');
    handle.rebind(newStream);
    expect(handle.isActive).toBe(true);
    newStream.triggerError();
    expect(handle.isActive).toBe(false);
  });
});
