/** @internal */

import type { ReconnectionPolicy } from '../../options.js';
import type { Logger } from '../../logger.js';
import { ConnectionState } from './connection-state.js';
import type { ConnectionStateMachine } from './connection-state-machine.js';

export interface ReconnectionContext {
  attempt: number;
  delayMs: number;
  elapsedMs: number;
}

export class ReconnectionManager {
  private readonly policy: Readonly<ReconnectionPolicy>;
  private readonly logger: Logger;
  private readonly stateMachine: ConnectionStateMachine;
  private abortController: AbortController | null = null;
  private attempt = 0;
  private startTime = 0;

  constructor(policy: ReconnectionPolicy, stateMachine: ConnectionStateMachine, logger: Logger) {
    this.policy = Object.freeze({ ...policy });
    this.stateMachine = stateMachine;
    this.logger = logger;
  }

  async reconnect(connectFn: () => Promise<void>): Promise<void> {
    this.attempt = 0;
    this.startTime = Date.now();
    this.abortController = new AbortController();

    while (!this.isExhausted() && !this.abortController.signal.aborted) {
      this.attempt++;
      const delayMs = this.calculateDelay();

      this.logger.info('Reconnection attempt', {
        attempt: this.attempt,
        delayMs,
        maxAttempts: this.policy.maxAttempts,
      });

      this.stateMachine.transitionTo(ConnectionState.RECONNECTING, {
        attempt: this.attempt,
      });

      await this.sleep(delayMs);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- may be aborted during sleep
      if (this.abortController.signal.aborted) break;

      try {
        await connectFn();
        this.logger.info('Reconnection successful', { attempt: this.attempt });
        this.reset();
        this.stateMachine.transitionTo(ConnectionState.READY);
        return;
      } catch (err: unknown) {
        this.logger.warn('Reconnection attempt failed', {
          attempt: this.attempt,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!this.abortController.signal.aborted) {
      this.logger.error('Reconnection exhausted', {
        attempts: this.attempt,
        elapsedMs: Date.now() - this.startTime,
      });
    }
  }

  cancel(): void {
    this.abortController?.abort();
  }

  private reset(): void {
    this.attempt = 0;
    this.startTime = 0;
    this.abortController = null;
  }

  private isExhausted(): boolean {
    if (this.policy.maxAttempts === -1) return false;
    return this.attempt >= this.policy.maxAttempts;
  }

  private calculateDelay(): number {
    const baseDelay = Math.min(
      this.policy.initialDelayMs * Math.pow(this.policy.multiplier, this.attempt - 1),
      this.policy.maxDelayMs,
    );

    switch (this.policy.jitter) {
      case 'full':
        return Math.random() * baseDelay;
      case 'equal':
        return baseDelay / 2 + Math.random() * (baseDelay / 2);
      case 'none':
        return baseDelay;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.abortController?.signal.aborted) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, ms);
      if (typeof timer === 'object' && 'unref' in timer) {
        timer.unref();
      }
      this.abortController?.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
}
