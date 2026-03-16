/** @internal */

import { ConnectionState, isValidTransition } from './connection-state.js';
import { SafeEventEmitter } from './typed-emitter.js';
import type { ConnectionEventMap } from './typed-emitter.js';
import type { Logger } from '../../logger.js';

export class ConnectionStateMachine {
  private _state: ConnectionState = ConnectionState.IDLE;
  private readonly emitter: SafeEventEmitter<ConnectionEventMap>;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.emitter = new SafeEventEmitter();
    this.emitter.setLogger(logger);
    this.logger = logger;
  }

  get state(): ConnectionState {
    return this._state;
  }

  transitionTo(
    newState: ConnectionState,
    meta?: { attempt?: number; discardedCount?: number },
  ): void {
    const oldState = this._state;
    if (!isValidTransition(oldState, newState)) {
      this.logger.warn('Invalid state transition attempted', {
        from: oldState,
        to: newState,
      });
      return;
    }

    this._state = newState;
    this.logger.info('Connection state changed', { from: oldState, to: newState });

    queueMicrotask(() => {
      this.emitter.emit('stateChange', newState);

      switch (newState) {
        case ConnectionState.READY:
          if (oldState === ConnectionState.CONNECTING) {
            this.emitter.emit('connected');
          } else if (oldState === ConnectionState.RECONNECTING) {
            this.emitter.emit('reconnected');
          }
          break;
        case ConnectionState.RECONNECTING:
          if (oldState !== ConnectionState.RECONNECTING) {
            this.emitter.emit('disconnected');
          }
          this.emitter.emit('reconnecting', meta?.attempt ?? 0);
          break;
        case ConnectionState.CLOSED:
          if (meta?.discardedCount !== undefined && meta.discardedCount > 0) {
            this.emitter.emit('bufferDrain', meta.discardedCount);
          }
          this.emitter.emit('closed');
          break;
      }
    });
  }

  on<K extends keyof ConnectionEventMap>(event: K, listener: ConnectionEventMap[K]): void {
    this.emitter.on(event, listener);
  }

  off<K extends keyof ConnectionEventMap>(event: K, listener: ConnectionEventMap[K]): void {
    this.emitter.off(event, listener);
  }
}
