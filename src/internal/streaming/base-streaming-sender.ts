/**
 * @internal — Abstract base class for shared bidi streaming senders.
 *
 * Provides: bounded queue, setImmediate-based drain loop with write
 * backpressure, transport state integration (no self-reconnect),
 * deadline sweep, AbortSignal support, error handler fan-out, and
 * observability stats.
 *
 * Subclasses implement openStream(), extractPendingKey(), handleResponse().
 */
import type { StreamHandle } from '../transport/transport.js';
import { ConnectionState } from '../transport/connection-state.js';
import {
  BufferFullError,
  SenderDisconnectedError,
  SenderClosedError,
  KubeMQTimeoutError,
  CancellationError,
  KubeMQError,
  ErrorCode,
} from '../../errors.js';
import type { Logger } from '../../logger.js';

// gRPC status codes used for error differentiation
const GRPC_CANCELLED = 1;
const GRPC_PERMISSION_DENIED = 7;
const GRPC_UNAUTHENTICATED = 16;

export type SenderStreamState = 'initializing' | 'connected' | 'reconnecting' | 'closed';

export interface SenderStats {
  queueDepth: number;
  pendingAcks: number;
  streamState: SenderStreamState;
  reconnectionCount: number;
}

export interface BaseSenderOptions {
  maxQueueSize: number;
  logger: Logger;
  clientId: string;
  closeTimeoutMs?: number;
}

export interface QueueItem<TReq> {
  request: TReq;
  resolve?: (value: unknown) => void;
  reject?: (err: Error) => void;
  deadline?: Date;
  signal?: AbortSignal;
  abortHandler?: () => void;
}

export abstract class BaseStreamingSender<TReq, TRes, TPendingKey> {
  protected readonly logger: Logger;
  protected readonly clientId: string;
  protected readonly maxQueueSize: number;
  protected readonly closeTimeoutMs: number;

  protected stream: StreamHandle<TReq, TRes> | null = null;
  protected queue: QueueItem<TReq>[] = [];
  protected pendingMap = new Map<
    TPendingKey,
    { resolve: (value: unknown) => void; reject: (err: Error) => void; deadline?: Date }
  >();
  protected errorHandlers = new Set<(err: Error) => void>();

  protected _streamState: SenderStreamState = 'initializing';
  protected _closed = false;
  protected _drainScheduled = false;
  protected _drainPaused = false;
  protected _reconnectionCount = 0;
  protected _sweepInterval: ReturnType<typeof setInterval> | null = null;

  // Transport state listener — stored for cleanup
  private _stateChangeHandler: ((state: ConnectionState) => void) | null = null;
  private _transportOn:
    | ((event: 'stateChange', handler: (state: ConnectionState) => void) => void)
    | null = null;
  private _transportOff:
    | ((event: 'stateChange', handler: (state: ConnectionState) => void) => void)
    | null = null;
  private _transportDuplexStream: (<TW, TR>(method: string) => StreamHandle<TW, TR>) | null = null;

  constructor(opts: BaseSenderOptions) {
    this.logger = opts.logger;
    this.clientId = opts.clientId;
    this.maxQueueSize = opts.maxQueueSize;
    this.closeTimeoutMs = opts.closeTimeoutMs ?? 5000;
  }

  /** Subclass provides the gRPC method name to open the bidi stream. */
  protected abstract grpcMethod(): string;

  /** Extract the pending-map key from a request (for storing before write). */
  protected abstract extractRequestKey(request: TReq): TPendingKey | null;

  /** Extract the pending-map key from a response (for matching ACKs). */
  protected abstract extractResponseKey(response: TRes): TPendingKey | null;

  /** Return true if the response indicates success. */
  protected abstract isResponseSuccess(response: TRes): boolean;

  /** Extract an error message from a failed response. */
  protected abstract responseErrorMessage(response: TRes): string;

  /**
   * Subscribe to transport state changes and optionally open the stream.
   * Must be called once after construction.
   */
  start(transport: {
    on(event: 'stateChange', handler: (state: ConnectionState) => void): void;
    off(event: 'stateChange', handler: (state: ConnectionState) => void): void;
    duplexStream<TW, TR>(method: string): StreamHandle<TW, TR>;
    readonly state: ConnectionState;
  }): void {
    this._transportOn = transport.on.bind(transport);
    this._transportOff = transport.off.bind(transport);
    this._transportDuplexStream = transport.duplexStream.bind(transport);

    this._stateChangeHandler = (state: ConnectionState) => {
      this._handleStateChange(state);
    };
    this._transportOn('stateChange', this._stateChangeHandler);

    // Start deadline sweep
    this._sweepInterval = setInterval(() => {
      this._sweepExpiredPending();
    }, 1000);
    if (typeof this._sweepInterval === 'object' && 'unref' in this._sweepInterval) {
      this._sweepInterval.unref();
    }

    // If transport is already READY, open stream now
    if (transport.state === ConnectionState.READY) {
      this._openStream();
    }
  }

  /** Enqueue a request. Returns a Promise for tracked items, void for fire-and-forget. */
  protected enqueue(
    request: TReq,
    tracked: boolean,
    deadline?: Date,
    signal?: AbortSignal,
  ): Promise<TRes> | undefined {
    if (this._closed) {
      throw new SenderClosedError({
        message: 'Sender is closed',
        operation: 'send',
      });
    }

    if (signal?.aborted) {
      throw new CancellationError({
        message: 'Send cancelled',
        operation: 'send',
      });
    }

    if (!tracked) {
      // Fire-and-forget: reject immediately if queue full
      if (this.queue.length >= this.maxQueueSize) {
        throw new BufferFullError({
          message: 'Send queue is full. Reduce send rate or increase maxQueueSize.',
          operation: 'send',
          isRetryable: false,
        });
      }
      const item: QueueItem<TReq> = { request };
      this.queue.push(item);
      this._scheduleDrain();
      return undefined;
    }

    // Tracked: return a Promise
    return new Promise<TRes>((resolve, reject) => {
      if (this.queue.length >= this.maxQueueSize) {
        reject(
          new BufferFullError({
            message: 'Send queue is full. Reduce send rate or increase maxQueueSize.',
            operation: 'send',
            isRetryable: false,
          }),
        );
        return;
      }

      const item: QueueItem<TReq> = {
        request,
        resolve: resolve as (value: unknown) => void,
        reject,
        deadline,
        signal,
      };

      // Wire AbortSignal for in-queue cancellation
      if (signal) {
        item.abortHandler = () => {
          const idx = this.queue.indexOf(item);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            reject(
              new CancellationError({
                message: 'Send cancelled',
                operation: 'send',
              }),
            );
          }
          // If not in queue (already written), signal is ignored — deadline governs.
        };
        signal.addEventListener('abort', item.abortHandler, { once: true });
      }

      this.queue.push(item);
      this._scheduleDrain();
    });
  }

  registerErrorHandler(handler: (err: Error) => void): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  getStats(): SenderStats {
    return {
      queueDepth: this.queue.length,
      pendingAcks: this.pendingMap.size,
      streamState: this._streamState,
      reconnectionCount: this._reconnectionCount,
    };
  }

  private _closePromise: Promise<void> | null = null;

  /** Issue 4 fix: concurrent close() calls share the same teardown promise. */
  close(timeoutMs?: number): Promise<void> {
    this._closePromise ??= this._doClose(timeoutMs);
    return this._closePromise;
  }

  private async _doClose(timeoutMs?: number): Promise<void> {
    this._closed = true;
    this._streamState = 'closed';
    this._drainPaused = false;

    if (this._sweepInterval) clearInterval(this._sweepInterval);
    this._sweepInterval = null;

    if (this._stateChangeHandler && this._transportOff) {
      this._transportOff('stateChange', this._stateChangeHandler);
    }

    // Reject all queued items — don't attempt to flush to stream to avoid
    // backpressure issues and dangling promises from tracked items not
    // entering pendingMap.
    const closeErr = new SenderClosedError({
      message: 'Sender closed with pending messages',
      operation: 'send',
    });
    for (const item of this.queue) {
      this._cleanupItemSignal(item);
      item.reject?.(closeErr);
    }
    this.queue = [];

    // Wait for pending acks up to timeout, then reject remaining.
    const deadline = Date.now() + (timeoutMs ?? this.closeTimeoutMs);
    const remaining = Math.max(0, deadline - Date.now());
    if (this.pendingMap.size > 0 && remaining > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        if (typeof timer === 'object' && 'unref' in timer) timer.unref();

        const checkDone = (): void => {
          if (this.pendingMap.size === 0) {
            clearTimeout(timer);
            resolve();
          }
        };

        // Wrap each pending entry so settlement triggers a drain check
        for (const [key, entry] of this.pendingMap) {
          const origResolve = entry.resolve;
          const origReject = entry.reject;
          this.pendingMap.set(key, {
            ...entry,
            resolve: (v: unknown) => {
              origResolve(v);
              checkDone();
            },
            reject: (e: Error) => {
              origReject(e);
              checkDone();
            },
          });
        }
      });
    }

    // Reject any still-pending
    for (const [, entry] of this.pendingMap) {
      entry.reject(
        new SenderClosedError({
          message: 'Sender closed with pending acks',
          operation: 'send',
        }),
      );
    }
    this.pendingMap.clear();

    // Close the stream
    try {
      this.stream?.end();
    } catch {
      /* ignore */
    }
    this.stream = null;
  }

  // ── Internal ──

  private _openStream(): void {
    if (this._closed || !this._transportDuplexStream) return;

    try {
      this.stream = this._transportDuplexStream<TReq, TRes>(this.grpcMethod());
    } catch {
      // Transport may not be ready — will retry on next READY state
      this._streamState = 'reconnecting';
      return;
    }

    this._streamState = 'connected';
    this._drainPaused = false;

    this.stream.onData((response: TRes) => {
      const key = this.extractResponseKey(response);
      if (key === null) return;
      const entry = this.pendingMap.get(key);
      if (!entry) return; // Late ACK after deadline expiry — silently ignored
      this.pendingMap.delete(key);

      if (this.isResponseSuccess(response)) {
        entry.resolve(response);
      } else {
        entry.reject(
          new KubeMQError({
            code: ErrorCode.Fatal,
            message: this.responseErrorMessage(response),
            operation: this.grpcMethod(),
            isRetryable: false,
          }),
        );
      }
    });

    this.stream.onError((err: Error) => {
      this._handleStreamError(err);
    });
    this.stream.onEnd(() => {
      this._handleStreamEnd();
    });

    // Drain any queued items
    this._scheduleDrain();
  }

  private _handleStreamError(err: Error): void {
    if (this._closed) return;

    const code = (err as { code?: number }).code;

    // Permanent errors — close sender
    if (code === GRPC_PERMISSION_DENIED || code === GRPC_UNAUTHENTICATED) {
      this._rejectAllPending(err);
      this._closed = true;
      this._streamState = 'closed';
      this.stream = null;
      this._drainPaused = false;
      this._emitError(err);
      return;
    }

    // Cancelled — intentional, no reconnect
    if (code === GRPC_CANCELLED) return;

    // Transient errors (UNAVAILABLE, RESOURCE_EXHAUSTED, etc.) — reject pending, preserve queue
    this._rejectAllPending(
      new SenderDisconnectedError({
        message: `Stream error: ${err.message}`,
        operation: 'send',
        cause: err,
      }),
    );
    this.stream = null;
    this._drainPaused = false;
    this._streamState = 'reconnecting';
    this._emitError(err);
    // Transport's ReconnectionManager will emit READY when reconnected
  }

  private _handleStreamEnd(): void {
    if (this._closed) return;
    this._rejectAllPending(
      new SenderDisconnectedError({
        message: 'Stream ended by server',
        operation: 'send',
      }),
    );
    this.stream = null;
    this._drainPaused = false;
    this._streamState = 'reconnecting';
  }

  private _handleStateChange(state: ConnectionState): void {
    if (this._closed) return;

    if (state === ConnectionState.RECONNECTING) {
      this._rejectAllPending(
        new SenderDisconnectedError({
          message: 'Transport reconnecting',
          operation: 'send',
        }),
      );
      this.stream = null;
      this._drainPaused = false;
      this._streamState = 'reconnecting';
    } else if (state === ConnectionState.READY) {
      this._reconnectionCount++;
      this._openStream();
    } else if (state === ConnectionState.CLOSED) {
      this._rejectAllPending(
        new SenderClosedError({
          message: 'Transport closed',
          operation: 'send',
        }),
      );
      this.stream = null;
      this._streamState = 'closed';
      this._closed = true;
    }
  }

  /**
   * Drain synchronously when possible (stream connected + no backpressure).
   * Only defers to setImmediate when called from contexts where sync drain
   * is unsafe (backpressure resume, reconnection).
   */
  protected _scheduleDrain(): void {
    if (this._drainPaused || this._closed) return;
    // Drain synchronously — this avoids the 1-tick latency of setImmediate
    // which was causing 2x throughput regression. The onData handler (ACK
    // processing) runs in a separate event loop callback, so synchronous
    // drain does not starve it.
    this._drain();
  }

  private _scheduleDrainDeferred(): void {
    if (this._drainScheduled || this._drainPaused || this._closed) return;
    this._drainScheduled = true;
    setImmediate(() => {
      this._drainScheduled = false;
      this._drain();
    });
  }

  private static readonly DRAIN_BATCH_SIZE = 64;

  private _drain(): void {
    if (!this.stream || this._closed) return;

    let written = 0;
    while (this.queue.length > 0) {
      const item = this.queue[0];
      if (!item) break;

      // Check deadline before writing
      if (item.deadline && Date.now() > item.deadline.getTime()) {
        this.queue.shift();
        this._cleanupItemSignal(item);
        item.reject?.(
          new KubeMQTimeoutError({
            message: 'Send deadline expired while queued',
            operation: 'send',
          }),
        );
        continue;
      }

      // Check abort signal
      if (item.signal?.aborted) {
        this.queue.shift();
        this._cleanupItemSignal(item);
        item.reject?.(
          new CancellationError({
            message: 'Send cancelled',
            operation: 'send',
          }),
        );
        continue;
      }

      // Remove from queue before writing
      this.queue.shift();
      this._cleanupItemSignal(item);

      // Track in pendingMap if this item has resolve/reject (before write, for response matching)
      if (item.resolve && item.reject) {
        const key = this.extractRequestKey(item.request);
        if (key !== null) {
          this.pendingMap.set(key, {
            resolve: item.resolve,
            reject: item.reject,
            deadline: item.deadline,
          });
        }
      }

      // Write to stream
      const ok = this.stream.write(item.request);

      if (!ok) {
        // Backpressure: pause drain, re-register one-shot onDrain handler
        this._drainPaused = true;
        this.stream.onDrain(() => {
          this._drainPaused = false;
          this._scheduleDrainDeferred();
        });
        return;
      }

      written++;
      if (written >= BaseStreamingSender.DRAIN_BATCH_SIZE && this.queue.length > 0) {
        this._scheduleDrainDeferred();
        return;
      }
    }
  }

  private _sweepExpiredPending(): void {
    const now = Date.now();
    for (const [key, entry] of this.pendingMap) {
      if (entry.deadline && now > entry.deadline.getTime()) {
        this.pendingMap.delete(key);
        entry.reject(
          new KubeMQTimeoutError({
            message: 'Send deadline expired waiting for ACK',
            operation: 'send',
          }),
        );
      }
    }
  }

  private _rejectAllPending(err: Error): void {
    for (const [, entry] of this.pendingMap) {
      entry.reject(err);
    }
    this.pendingMap.clear();
  }

  private _emitError(err: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(err);
      } catch {
        /* ignore handler errors */
      }
    }
  }

  private _cleanupItemSignal(item: QueueItem<TReq>): void {
    if (item.signal && item.abortHandler) {
      item.signal.removeEventListener('abort', item.abortHandler);
      item.abortHandler = undefined;
    }
  }
}
