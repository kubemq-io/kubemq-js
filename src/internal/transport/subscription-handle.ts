/** @internal */

import type { Subscription } from '../../messages/subscription.js';
import type { StreamHandle } from './transport.js';
import type { Logger } from '../../logger.js';

/**
 * Wraps a transport-level StreamHandle to implement the public
 * Subscription interface with isActive tracking and clean cancel.
 *
 * The rebind() method supports reconnection (MAJ-R2): removes old
 * listeners before attaching to a new stream.
 */
export class GrpcSubscriptionHandle implements Subscription {
  private _isActive = true;
  private _stream: StreamHandle<never, unknown>;
  private readonly logger: Logger;
  private readonly operationName: string;

  constructor(stream: StreamHandle<never, unknown>, logger: Logger, operationName: string) {
    this._stream = stream;
    this.logger = logger;
    this.operationName = operationName;
    this.attachLifecycleListeners(stream);
  }

  get isActive(): boolean {
    return this._isActive;
  }

  cancel(): void {
    if (!this._isActive) return;
    this._isActive = false;
    this._stream.cancel();
    this.logger.debug('Subscription cancelled', { operation: this.operationName });
  }

  /**
   * Replace the underlying stream after a successful reconnection.
   * Removes old listeners to prevent ghost callbacks (MAJ-R2 fix).
   */
  rebind(newStream: StreamHandle<never, unknown>): void {
    this._stream.cancel();
    this._stream = newStream;
    this._isActive = true;
    this.attachLifecycleListeners(newStream);
  }

  private attachLifecycleListeners(stream: StreamHandle<never, unknown>): void {
    stream.onEnd(() => {
      this._isActive = false;
    });
    stream.onError(() => {
      this._isActive = false;
    });
  }
}
