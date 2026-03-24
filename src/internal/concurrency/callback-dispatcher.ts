import { AsyncSemaphore } from './semaphore.js';
import { HandlerError, ErrorCode, type KubeMQError } from '../../errors.js';
import type { Logger } from '../../logger.js';

export interface CallbackDispatcherOptions {
  maxConcurrent: number;
  /** Maximum number of messages waiting in the semaphore queue before triggering backpressure. Default: 1000. */
  maxQueueDepth?: number;
  /**
   * If true, drop messages when queue depth exceeds maxQueueDepth instead of
   * calling onHighWater (which pauses the stream). Default: false.
   */
  dropOnHighWater?: boolean;
  logger: Logger;
  onError: (err: KubeMQError) => void;
  /** Called when the internal queue depth reaches maxQueueDepth — pause the source stream. */
  onHighWater?: () => void;
  /** Called when the internal queue depth drops below maxQueueDepth/2 — resume the source stream. */
  onLowWater?: () => void;
}

/**
 * Dispatches subscription callbacks with configurable concurrency.
 *
 * Default concurrency = 1 ensures sequential processing (Node.js event loop
 * natural behavior preserved). Higher concurrency enables parallel processing
 * at the cost of message ordering.
 *
 * C3 fix: Added high/low water mark backpressure to prevent unbounded queue growth
 * when the gRPC stream delivers messages faster than the handler can process them.
 *
 * @remarks
 * `this.active++` is in synchronous position (before the async callback
 * starts) to prevent a race condition where `drain()` resolves before
 * the callback has been scheduled.
 */
export class CallbackDispatcher<T> {
  private readonly semaphore: AsyncSemaphore;
  private readonly logger: Logger;
  private readonly onError: (err: KubeMQError) => void;
  private readonly maxQueueDepth: number;
  private readonly onHighWater?: () => void;
  private readonly onLowWater?: () => void;
  private readonly _dropOnHighWater: boolean;
  private active = 0;
  private _closed = false;
  private _paused = false;
  private _dropCount = 0;
  private drainResolvers: (() => void)[] = [];

  constructor(opts: CallbackDispatcherOptions) {
    this.semaphore = new AsyncSemaphore(opts.maxConcurrent);
    this.logger = opts.logger;
    this.onError = opts.onError;
    this.maxQueueDepth = opts.maxQueueDepth ?? 1000;
    this._dropOnHighWater = opts.dropOnHighWater ?? false;
    this.onHighWater = opts.onHighWater;
    this.onLowWater = opts.onLowWater;
  }

  /**
   * Dispatch a message to the handler with concurrency control.
   * Handler exceptions are caught and forwarded to onError — they never
   * terminate the subscription (GS-01 REQ-ERR-9).
   */
  dispatch(handler: (msg: T) => void | Promise<void>, msg: T): void {
    if (this._closed) return;

    // C3 fix: check high water mark — either drop or pause
    if (this.semaphore.waiting >= this.maxQueueDepth) {
      if (this._dropOnHighWater) {
        this._dropCount++;
        return; // silently drop — do not pause stream
      }
      if (!this._paused && this.onHighWater) {
        this._paused = true;
        this.onHighWater();
      }
    }

    // CRIT-R2: increment synchronously before any async work
    this.active++;

    const run = async (): Promise<void> => {
      try {
        await this.semaphore.run(async () => {
          await handler(msg);
        });
      } catch (err: unknown) {
        const handlerErr = new HandlerError({
          code: ErrorCode.Fatal,
          message: `Message handler threw: ${err instanceof Error ? err.message : String(err)}`,
          operation: 'messageHandler',
          isRetryable: false,
          cause: err instanceof Error ? err : undefined,
          suggestion: 'Fix the exception in your message handler function.',
        });
        this.logger.error('Subscription callback error', {
          error: handlerErr.message,
        });
        this.onError(handlerErr);
      } finally {
        this.active--;

        // C3 fix: check low water mark and signal resume
        if (this._paused && this.onLowWater && this.semaphore.waiting < this.maxQueueDepth / 2) {
          this._paused = false;
          this.onLowWater();
        }

        if (this.active === 0) {
          for (const resolve of this.drainResolvers.splice(0)) {
            resolve();
          }
        }
      }
    };

    void run();
  }

  /**
   * Wait for all in-flight callbacks to complete.
   * Resolves immediately if no callbacks are active.
   * Used during graceful shutdown (REQ-CONC-5).
   */
  async drain(): Promise<void> {
    if (this.active === 0) return;
    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  get inFlightCount(): number {
    return this.active;
  }

  get isClosed(): boolean {
    return this._closed;
  }

  /** Number of messages dropped due to dropOnHighWater mode. */
  get dropCount(): number {
    return this._dropCount;
  }

  close(): void {
    this._closed = true;
    // Resolve any pending drain() waiters so they don't hang
    for (const resolve of this.drainResolvers.splice(0)) {
      resolve();
    }
  }
}
