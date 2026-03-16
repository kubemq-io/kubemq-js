/** @internal */

import { EventEmitter } from 'node:events';
import type { ConnectionState } from './connection-state.js';

/**
 * Typed event map for {@link KubeMQClient.on} and {@link KubeMQClient.off}.
 *
 * @remarks
 * Subscribe to connection lifecycle events to implement custom monitoring,
 * health checks, or reconnection logging.
 *
 * @see {@link KubeMQClient.on}
 * @see {@link KubeMQClient.off}
 * @see {@link ConnectionState}
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type ConnectionEventMap = {
  /** Fired when the initial connection is established. */
  connected: () => void;
  /** Fired when the connection is lost. */
  disconnected: () => void;
  /** Fired on each reconnection attempt, with the attempt number. */
  reconnecting: (attempt: number) => void;
  /** Fired when the connection is successfully re-established. */
  reconnected: () => void;
  /** Fired when the client is permanently closed. */
  closed: () => void;
  /** Fired when reconnect-buffered messages are discarded. */
  bufferDrain: (discardedCount: number) => void;
  /** Fired on every connection state transition. */
  stateChange: (state: ConnectionState) => void;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TypedEventEmitter<TEvents extends Record<string, (...args: any[]) => void>> {
  on<K extends keyof TEvents & string>(event: K, listener: TEvents[K]): this;
  once<K extends keyof TEvents & string>(event: K, listener: TEvents[K]): this;
  off<K extends keyof TEvents & string>(event: K, listener: TEvents[K]): this;
  emit<K extends keyof TEvents & string>(event: K, ...args: Parameters<TEvents[K]>): boolean;
}

export class SafeEventEmitter<TEvents extends Record<string, (...args: any[]) => void>>
  extends EventEmitter
  implements TypedEventEmitter<TEvents>
{
  #logger?: { warn(msg: string, fields?: Record<string, unknown>): void };

  setLogger(logger: { warn(msg: string, fields?: Record<string, unknown>): void }): void {
    this.#logger = logger;
  }

  override emit<K extends keyof TEvents & string>(
    event: K,
    ...args: Parameters<TEvents[K]>
  ): boolean {
    try {
      return super.emit(event, ...args);
    } catch (err: unknown) {
      this.#logger?.warn('Event handler threw an exception', {
        event,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
