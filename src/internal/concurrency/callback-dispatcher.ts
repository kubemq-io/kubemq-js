import { AsyncSemaphore } from './semaphore.js';
import { HandlerError, ErrorCode, type KubeMQError } from '../../errors.js';
import type { Logger } from '../../logger.js';

export interface CallbackDispatcherOptions {
  maxConcurrent: number;
  logger: Logger;
  onError: (err: KubeMQError) => void;
}

/**
 * Dispatches subscription callbacks with configurable concurrency.
 *
 * Default concurrency = 1 ensures sequential processing (Node.js event loop
 * natural behavior preserved). Higher concurrency enables parallel processing
 * at the cost of message ordering.
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
  private active = 0;
  private _closed = false;
  private drainResolvers: (() => void)[] = [];

  constructor(opts: CallbackDispatcherOptions) {
    this.semaphore = new AsyncSemaphore(opts.maxConcurrent);
    this.logger = opts.logger;
    this.onError = opts.onError;
  }

  /**
   * Dispatch a message to the handler with concurrency control.
   * Handler exceptions are caught and forwarded to onError — they never
   * terminate the subscription (GS-01 REQ-ERR-9).
   */
  dispatch(handler: (msg: T) => void | Promise<void>, msg: T): void {
    if (this._closed) return;

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

  close(): void {
    this._closed = true;
  }
}
