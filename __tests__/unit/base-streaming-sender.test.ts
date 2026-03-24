import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockTransport } from '../fixtures/mock-transport.js';
import {
  BaseStreamingSender,
  type BaseSenderOptions,
} from '../../src/internal/streaming/base-streaming-sender.js';
import {
  SenderClosedError,
  SenderDisconnectedError,
  BufferFullError,
  CancellationError,
  KubeMQTimeoutError,
} from '../../src/errors.js';
import { ConnectionState } from '../../src/internal/transport/connection-state.js';

// ── Test interfaces ──

interface TestRequest {
  id: string;
  data?: string;
}

interface TestResponse {
  id: string;
  success: boolean;
  error?: string;
}

// ── Concrete subclass for testing ──

class TestableStreamingSender extends BaseStreamingSender<TestRequest, TestResponse, string> {
  protected grpcMethod(): string {
    return 'TestStream';
  }

  protected extractRequestKey(req: TestRequest): string {
    return req.id;
  }

  protected extractResponseKey(res: TestResponse): string {
    return res.id;
  }

  protected isResponseSuccess(res: TestResponse): boolean {
    return res.success;
  }

  protected responseErrorMessage(res: TestResponse): string {
    return res.error || 'test error';
  }

  // Expose protected methods for testing
  sendTracked(req: TestRequest, deadline?: Date, signal?: AbortSignal): Promise<TestResponse> {
    return this.enqueue(req, true, deadline, signal) as Promise<TestResponse>;
  }

  sendFireAndForget(req: TestRequest): void {
    this.enqueue(req, false);
  }
}

// ── Helpers ──

function createSender(opts?: Partial<BaseSenderOptions>) {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const sender = new TestableStreamingSender({
    maxQueueSize: opts?.maxQueueSize ?? 100,
    logger: logger as any,
    clientId: 'test',
    closeTimeoutMs: opts?.closeTimeoutMs ?? 500,
    ...opts,
  });
  return { sender, logger };
}

/**
 * Intercept duplexStream calls on the transport so we can get a reference
 * to the MockStreamHandle created inside _openStream().
 */
function captureDuplexStream(transport: MockTransport) {
  let capturedStream: any;
  const origDuplex = transport.duplexStream.bind(transport);
  transport.duplexStream = (...args: any[]) => {
    const s = (origDuplex as any)(...args);
    capturedStream = s;
    return s;
  };
  return () => capturedStream;
}

// ── Tests ──

describe('BaseStreamingSender', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ────────────────────────────────────────────────────────────────────
  // _handleStreamError
  // ────────────────────────────────────────────────────────────────────
  describe('_handleStreamError', () => {
    it('PERMISSION_DENIED closes sender and rejects pending', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect(); // transitions to READY
      sender.start(transport);

      const stream = getStream();
      expect(stream).toBeDefined();

      const promise = sender.sendTracked({ id: 'req-1' });

      // Simulate a PERMISSION_DENIED gRPC error (code 7)
      const err = Object.assign(new Error('denied'), { code: 7 });
      stream.simulateError(err);

      await expect(promise).rejects.toThrow();
      expect(sender.getStats().streamState).toBe('closed');
    });

    it('UNAUTHENTICATED closes sender and rejects pending', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      const promise = sender.sendTracked({ id: 'req-1' });

      const err = Object.assign(new Error('unauthenticated'), { code: 16 });
      stream.simulateError(err);

      await expect(promise).rejects.toThrow();
      expect(sender.getStats().streamState).toBe('closed');
    });

    it('CANCELLED is silently ignored', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      const promise = sender.sendTracked({ id: 'req-1' });

      // State before the error
      expect(sender.getStats().streamState).toBe('connected');

      const err = Object.assign(new Error('cancelled'), { code: 1 });
      stream.simulateError(err);

      // State should remain connected — CANCELLED is a no-op
      expect(sender.getStats().streamState).toBe('connected');
      // The pending item should still be in pendingMap (NOT rejected)
      expect(sender.getStats().pendingAcks).toBe(1);

      // Resolve the pending to clean up
      stream.simulateData({ id: 'req-1', success: true });
      await expect(promise).resolves.toEqual({ id: 'req-1', success: true });
    });

    it('transient error rejects pending with SenderDisconnectedError', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      const promise = sender.sendTracked({ id: 'req-1' });

      // UNAVAILABLE — code 14, a transient error
      const err = Object.assign(new Error('unavailable'), { code: 14 });
      stream.simulateError(err);

      await expect(promise).rejects.toThrow(SenderDisconnectedError);
      expect(sender.getStats().streamState).toBe('reconnecting');
    });

    it('error handler receives emitted errors on permanent error', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      const handler = vi.fn();
      sender.registerErrorHandler(handler);

      // Send a tracked request so there is a pending item
      const promise = sender.sendTracked({ id: 'req-1' });

      const err = Object.assign(new Error('denied'), { code: 7 });
      stream.simulateError(err);

      // Handler should have been called with the original error
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(err);

      // Clean up the rejected promise
      await expect(promise).rejects.toThrow();
    });

    it('error when already closed is no-op', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      await sender.close();

      // Should not throw
      const err = Object.assign(new Error('denied'), { code: 7 });
      stream.simulateError(err);

      expect(sender.getStats().streamState).toBe('closed');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // _handleStateChange
  // ────────────────────────────────────────────────────────────────────
  describe('_handleStateChange', () => {
    it('CLOSED rejects pending and marks closed', async () => {
      const { sender } = createSender();
      captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const promise = sender.sendTracked({ id: 'req-1' });

      // Transport closes — emits CLOSED state
      await transport.close();

      await expect(promise).rejects.toThrow(SenderClosedError);
      expect(sender.getStats().streamState).toBe('closed');
    });

    it('RECONNECTING rejects pending and sets reconnecting', async () => {
      const { sender } = createSender();
      captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const promise = sender.sendTracked({ id: 'req-1' });

      transport.simulateDisconnect();

      await expect(promise).rejects.toThrow(SenderDisconnectedError);
      expect(sender.getStats().streamState).toBe('reconnecting');
    });

    it('READY increments reconnectionCount and reopens stream', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const firstStream = getStream();
      expect(firstStream).toBeDefined();

      // Initial start with READY transport increments reconnectionCount once
      // (because the transport was already READY when start() called, and
      // subsequent READY events increment the counter)
      const initialCount = sender.getStats().reconnectionCount;

      // Disconnect then reconnect
      transport.simulateDisconnect();
      transport.simulateReconnect();

      expect(sender.getStats().reconnectionCount).toBe(initialCount + 1);
      // A new stream should have been opened
      const secondStream = getStream();
      expect(secondStream).toBeDefined();
      expect(secondStream).not.toBe(firstStream);
      expect(sender.getStats().streamState).toBe('connected');
    });

    it('state changes ignored when sender already closed', async () => {
      const { sender } = createSender();
      captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      await sender.close();
      expect(sender.getStats().streamState).toBe('closed');

      // Simulate disconnect — should be ignored since sender is closed
      transport.simulateDisconnect();
      expect(sender.getStats().streamState).toBe('closed');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // _openStream
  // ────────────────────────────────────────────────────────────────────
  describe('_openStream', () => {
    it('duplexStream throw sets reconnecting', async () => {
      const { sender } = createSender();

      // Make duplexStream throw on first call
      const origDuplex = transport.duplexStream.bind(transport);
      let callCount = 0;
      transport.duplexStream = (...args: any[]) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('transport not ready');
        }
        return (origDuplex as any)(...args);
      };

      await transport.connect();
      sender.start(transport);

      // _openStream was called because transport was READY, but it threw
      expect(sender.getStats().streamState).toBe('reconnecting');
    });

    it('no-op when closed', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      // Start with IDLE transport (no READY yet)
      sender.start(transport);
      await sender.close();

      // Now connect — READY state fires but sender is closed
      await transport.connect();

      // No stream should have been opened
      expect(getStream()).toBeUndefined();
      expect(sender.getStats().streamState).toBe('closed');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // _drain backpressure
  // ────────────────────────────────────────────────────────────────────
  describe('_drain backpressure', () => {
    it('write returning false pauses drain', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      stream.setBackpressure(true);

      // Enqueue 3 fire-and-forget items
      sender.sendFireAndForget({ id: 'a' });
      sender.sendFireAndForget({ id: 'b' });
      sender.sendFireAndForget({ id: 'c' });

      // Only the first should have been written (write returns false → pause)
      expect(stream.written.length).toBe(1);
      expect(stream.written[0]).toEqual({ id: 'a' });
    });

    it('drain resumes after triggerDrain', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      stream.setBackpressure(true);

      sender.sendFireAndForget({ id: 'a' });
      sender.sendFireAndForget({ id: 'b' });
      sender.sendFireAndForget({ id: 'c' });

      expect(stream.written.length).toBe(1);

      // Remove backpressure and trigger drain
      stream.setBackpressure(false);
      stream.triggerDrain();

      // The deferred drain uses setImmediate, so wait for it
      await new Promise((r) => setImmediate(r));

      expect(stream.written.length).toBe(3);
      expect(stream.written.map((w: TestRequest) => w.id)).toEqual(['a', 'b', 'c']);
    });

    it('batch size limit triggers deferred drain', async () => {
      const { sender } = createSender({ maxQueueSize: 200 });
      const getStream = captureDuplexStream(transport);

      // Start without connecting — items accumulate in the queue
      sender.start(transport);

      // Enqueue 65 items while there is no stream (they stay in queue)
      for (let i = 0; i < 65; i++) {
        sender.sendFireAndForget({ id: `item-${i}` });
      }

      expect(sender.getStats().queueDepth).toBe(65);

      // Now connect — READY fires, _openStream creates stream and drains
      await transport.connect();

      const stream = getStream();

      // The drain loop writes up to DRAIN_BATCH_SIZE (64) synchronously,
      // then defers remaining via setImmediate
      expect(stream.written.length).toBe(64);

      // After setImmediate, the 65th should be written
      await new Promise((r) => setImmediate(r));

      expect(stream.written.length).toBe(65);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // close
  // ────────────────────────────────────────────────────────────────────
  describe('close', () => {
    it('concurrent close shares same promise', async () => {
      const { sender } = createSender();
      captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const p1 = sender.close();
      const p2 = sender.close();

      // Both calls should return the exact same promise
      expect(p1).toBe(p2);
      await p1;
      await p2;
    });

    it('rejects queued items with SenderClosedError', async () => {
      const { sender } = createSender();

      // Don't connect — items stay in queue (no stream to drain to)
      sender.start(transport);

      const promise = sender.sendTracked({ id: 'req-1' });

      await sender.close();

      await expect(promise).rejects.toThrow(SenderClosedError);
    });

    it('waits for pending acks then rejects remaining', async () => {
      const { sender } = createSender({ closeTimeoutMs: 100 });
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();

      // Enqueue a tracked item — it gets written and moved to pendingMap
      const promise = sender.sendTracked({ id: 'req-1' });
      expect(sender.getStats().pendingAcks).toBe(1);

      // Close with short timeout — pending won't resolve in time
      await sender.close(100);

      // Should be rejected with SenderClosedError after timeout
      await expect(promise).rejects.toThrow(SenderClosedError);
      expect(sender.getStats().pendingAcks).toBe(0);
    });

    it('pending resolve during close triggers early completion', async () => {
      const { sender } = createSender({ closeTimeoutMs: 5000 });
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();

      const promise = sender.sendTracked({ id: 'req-1' });
      expect(sender.getStats().pendingAcks).toBe(1);

      // Start close (will wait up to 5000ms for pending)
      const closePromise = sender.close(5000);

      // Resolve the pending item by simulating a success response
      stream.simulateData({ id: 'req-1', success: true });

      // The close should complete quickly now
      await closePromise;

      await expect(promise).resolves.toEqual({ id: 'req-1', success: true });
    });

    it('calls stream.end()', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      const endSpy = vi.fn();
      stream.onEnd(endSpy);

      await sender.close();

      // stream.end() fires all onEnd handlers in the mock
      expect(endSpy).toHaveBeenCalledTimes(1);
    });

    it('handles stream.end() throwing', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();

      // Make end() throw by adding a handler that throws
      // But the real implementation wraps stream.end() in try/catch
      // Let's override end() on the stream to throw
      const origEnd = stream.end.bind(stream);
      stream.end = () => {
        throw new Error('end failed');
      };

      // close() should not throw even if stream.end() throws
      await expect(sender.close()).resolves.toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // _sweepExpiredPending
  // ────────────────────────────────────────────────────────────────────
  describe('_sweepExpiredPending', () => {
    it('expired entries rejected with KubeMQTimeoutError', async () => {
      vi.useFakeTimers();

      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();

      // Send a tracked request with a deadline that is already in the past
      // We need the deadline to be in the future when enqueue runs (so it
      // doesn't get caught by the drain deadline check), but in the past
      // when the sweep runs.
      const deadline = new Date(Date.now() + 500); // 500ms from now
      const promise = sender.sendTracked({ id: 'req-1' }, deadline);

      // Item should be in pendingMap after drain
      expect(sender.getStats().pendingAcks).toBe(1);

      // Advance time past the deadline and past the sweep interval (1s)
      vi.advanceTimersByTime(1100);

      await expect(promise).rejects.toThrow(KubeMQTimeoutError);
      expect(sender.getStats().pendingAcks).toBe(0);

      vi.useRealTimers();
    });

    it('non-expired entries left intact', async () => {
      vi.useFakeTimers();

      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      // Deadline is 10 seconds from now
      const deadline = new Date(Date.now() + 10_000);
      const promise = sender.sendTracked({ id: 'req-1' }, deadline);

      expect(sender.getStats().pendingAcks).toBe(1);

      // Advance time by 1.1s (sweep fires, but deadline not reached)
      vi.advanceTimersByTime(1100);

      // Entry should still be in pendingMap
      expect(sender.getStats().pendingAcks).toBe(1);

      // Clean up: resolve the pending item
      const stream = getStream();
      stream.simulateData({ id: 'req-1', success: true });

      await expect(promise).resolves.toEqual({ id: 'req-1', success: true });

      vi.useRealTimers();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // enqueue
  // ────────────────────────────────────────────────────────────────────
  describe('enqueue', () => {
    it('throws SenderClosedError when closed', async () => {
      const { sender } = createSender();
      await sender.close();

      expect(() => sender.sendTracked({ id: 'req-1' })).toThrow(SenderClosedError);
    });

    it('throws CancellationError for pre-aborted signal', () => {
      const { sender } = createSender();

      const ac = new AbortController();
      ac.abort();

      expect(() => sender.sendTracked({ id: 'req-1' }, undefined, ac.signal)).toThrow(
        CancellationError,
      );
    });

    it('BufferFullError for untracked when queue full', () => {
      const { sender } = createSender({ maxQueueSize: 2 });

      // Don't connect — items stay in queue
      sender.start(transport);

      sender.sendFireAndForget({ id: 'a' });
      sender.sendFireAndForget({ id: 'b' });

      expect(() => sender.sendFireAndForget({ id: 'c' })).toThrow(BufferFullError);
    });

    it('BufferFullError for tracked when queue full', async () => {
      const { sender } = createSender({ maxQueueSize: 2 });

      // Don't connect — items stay in queue
      sender.start(transport);

      sender.sendFireAndForget({ id: 'a' });
      sender.sendFireAndForget({ id: 'b' });

      const promise = sender.sendTracked({ id: 'c' });
      await expect(promise).rejects.toThrow(BufferFullError);
    });

    it('AbortSignal in-queue cancellation removes item', async () => {
      const { sender } = createSender();

      // Don't connect — items stay in queue
      sender.start(transport);

      const ac = new AbortController();
      const promise = sender.sendTracked({ id: 'req-1' }, undefined, ac.signal);

      expect(sender.getStats().queueDepth).toBe(1);

      // Abort while still in queue
      ac.abort();

      await expect(promise).rejects.toThrow(CancellationError);
      expect(sender.getStats().queueDepth).toBe(0);
    });

    it('abort listener cleaned up after dequeue', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      const ac = new AbortController();

      // Don't connect yet — item stays in queue
      sender.start(transport);

      const promise = sender.sendTracked({ id: 'req-1' }, undefined, ac.signal);
      expect(sender.getStats().queueDepth).toBe(1);

      // Now connect — drain runs, item moves from queue to pendingMap
      await transport.connect();
      // After connect, start already wired up state change handler, so
      // READY fires and _openStream + drain runs
      // Actually, since we called sender.start(transport) before connect,
      // the stateChange handler is registered, so transport.connect()
      // transitioning to READY will trigger _handleStateChange(READY)

      // Wait for drain
      await new Promise((r) => setImmediate(r));

      expect(sender.getStats().queueDepth).toBe(0);
      expect(sender.getStats().pendingAcks).toBe(1);

      // Abort should NOT reject the promise (item is no longer in queue,
      // signal listener was cleaned up during dequeue)
      ac.abort();

      // The pending item should still be there
      expect(sender.getStats().pendingAcks).toBe(1);

      // Resolve it to clean up
      const stream = getStream();
      stream.simulateData({ id: 'req-1', success: true });

      await expect(promise).resolves.toEqual({ id: 'req-1', success: true });
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // registerErrorHandler
  // ────────────────────────────────────────────────────────────────────
  describe('registerErrorHandler', () => {
    it('returns unsubscribe function', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      const handler = vi.fn();
      const unsubscribe = sender.registerErrorHandler(handler);

      // Unsubscribe before triggering error
      unsubscribe();

      const promise = sender.sendTracked({ id: 'req-1' });

      // Trigger permanent error
      const err = Object.assign(new Error('denied'), { code: 7 });
      stream.simulateError(err);

      // Handler should NOT have been called
      expect(handler).not.toHaveBeenCalled();

      await expect(promise).rejects.toThrow();
    });

    it('handler exceptions are swallowed', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();

      const throwingHandler = vi.fn(() => {
        throw new Error('handler exploded');
      });
      sender.registerErrorHandler(throwingHandler);

      const promise = sender.sendTracked({ id: 'req-1' });

      // Should not throw even though handler throws
      const err = Object.assign(new Error('denied'), { code: 7 });
      stream.simulateError(err);

      expect(throwingHandler).toHaveBeenCalledTimes(1);

      await expect(promise).rejects.toThrow();
    });

    it('multiple handlers all receive error', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      sender.registerErrorHandler(handler1);
      sender.registerErrorHandler(handler2);

      const promise = sender.sendTracked({ id: 'req-1' });

      const err = Object.assign(new Error('denied'), { code: 7 });
      stream.simulateError(err);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledWith(err);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledWith(err);

      await expect(promise).rejects.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // getStats
  // ────────────────────────────────────────────────────────────────────
  describe('getStats', () => {
    it('returns correct initial values', () => {
      const { sender } = createSender();

      const stats = sender.getStats();
      expect(stats.queueDepth).toBe(0);
      expect(stats.pendingAcks).toBe(0);
      expect(stats.streamState).toBe('initializing');
      expect(stats.reconnectionCount).toBe(0);
    });

    it('reflects queue and pending counts', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      // Enqueue without a stream — items stay in queue
      sender.start(transport);
      sender.sendFireAndForget({ id: 'a' });
      sender.sendFireAndForget({ id: 'b' });
      // Note: sendTracked also adds to queue but returns a promise
      const trackedPromise = sender.sendTracked({ id: 'c' });

      expect(sender.getStats().queueDepth).toBe(3);
      expect(sender.getStats().pendingAcks).toBe(0);

      // Now connect — drain runs, items move to stream
      await transport.connect();
      await new Promise((r) => setImmediate(r));

      const stream = getStream();
      // Fire-and-forget items don't go to pendingMap, tracked item does
      expect(sender.getStats().queueDepth).toBe(0);
      expect(sender.getStats().pendingAcks).toBe(1);

      // Resolve tracked to clean up
      stream.simulateData({ id: 'c', success: true });
      await expect(trackedPromise).resolves.toEqual({ id: 'c', success: true });

      expect(sender.getStats().pendingAcks).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // _handleStreamEnd
  // ────────────────────────────────────────────────────────────────────
  describe('_handleStreamEnd', () => {
    it('sets reconnecting and rejects pending', async () => {
      const { sender } = createSender();
      const getStream = captureDuplexStream(transport);

      await transport.connect();
      sender.start(transport);

      const stream = getStream();
      const promise = sender.sendTracked({ id: 'req-1' });

      expect(sender.getStats().pendingAcks).toBe(1);

      // Simulate stream end (server-side close)
      stream.simulateEnd();

      expect(sender.getStats().streamState).toBe('reconnecting');
      await expect(promise).rejects.toThrow(SenderDisconnectedError);
      expect(sender.getStats().pendingAcks).toBe(0);
    });
  });
});
