/** @internal — stream lifecycle management, not part of public API */

import { StreamBrokenError, ErrorCode } from '../../errors.js';
import { computeBackoffMs } from '../middleware/retry.js';
import type { RetryPolicy } from '../../options.js';
import type { Logger } from '../../logger.js';

// ─── In-Flight Message Tracking ─────────────────────────────────────

interface InFlightMessage {
  messageId: string;
  sentAt: number;
}

// ─── Stream State ────────────────────────────────────────────────────

export type StreamState = 'idle' | 'active' | 'reconnecting' | 'closed';

// ─── StreamManager ──────────────────────────────────────────────────

/**
 * Manages gRPC stream lifecycle: in-flight message tracking,
 * reconnection backoff, and stream-break error generation.
 *
 * Stream state is independent of connection state (per GS REQ-ERR-8).
 */
export class StreamManager {
  private readonly inFlight = new Map<string, InFlightMessage>();
  private reconnectAttempt = 0;
  private _state: StreamState = 'idle';

  constructor(
    private readonly policy: Readonly<RetryPolicy>,
    private readonly logger: Logger,
  ) {}

  get state(): StreamState {
    return this._state;
  }

  /** Transition stream to active state (after connect or reconnect). */
  activate(): void {
    this._state = 'active';
    this.resetReconnectState();
  }

  /** Track a sent message for unacknowledged detection on break. */
  trackSend(messageId: string): void {
    this.inFlight.set(messageId, { messageId, sentAt: Date.now() });
  }

  /** Mark a message as acknowledged — remove from in-flight tracking. */
  acknowledgeMessage(messageId: string): void {
    this.inFlight.delete(messageId);
  }

  /** Number of in-flight (unacknowledged) messages. */
  get pendingCount(): number {
    return this.inFlight.size;
  }

  /**
   * Handle a stream-level break. Returns a StreamBrokenError containing
   * the IDs of all unacknowledged messages. Clears the in-flight registry.
   */
  handleStreamBreak(cause: Error): StreamBrokenError {
    const unackedIds = Array.from(this.inFlight.values()).map((m) => m.messageId);
    this.inFlight.clear();
    this._state = 'reconnecting';

    this.logger.warn('Stream broken', {
      unacknowledgedCount: unackedIds.length,
      reconnectAttempt: this.reconnectAttempt,
      cause: cause.message,
    });

    return new StreamBrokenError({
      code: ErrorCode.StreamBroken,
      message: `Stream broken with ${String(unackedIds.length)} unacknowledged messages`,
      operation: 'stream',
      isRetryable: true,
      cause,
      unacknowledgedMessageIds: unackedIds,
      suggestion: 'The SDK will attempt to reconnect the stream.',
    });
  }

  /**
   * Compute the next reconnection delay using exponential backoff.
   * Each call increments the internal attempt counter.
   */
  getReconnectDelay(): number {
    const delay = computeBackoffMs(this.reconnectAttempt, this.policy);
    this.reconnectAttempt++;
    return delay;
  }

  /** Check whether reconnection has exceeded the policy limit. */
  isReconnectExhausted(): boolean {
    return this.reconnectAttempt > this.policy.maxRetries;
  }

  /** Reset backoff counter — called after successful reconnection. */
  resetReconnectState(): void {
    this.reconnectAttempt = 0;
  }

  /**
   * Determine whether a stream-level error is fatal (should not reconnect)
   * or transient (should trigger reconnection).
   *
   * Fatal conditions:
   * - Authentication/authorization errors
   * - Client explicitly closed
   * - Reconnect attempts exhausted
   */
  isFatalStreamError(statusCode: number | undefined): boolean {
    if (statusCode === 7 || statusCode === 16) return true; // PERMISSION_DENIED, UNAUTHENTICATED
    if (this._state === 'closed') return true;
    if (this.isReconnectExhausted()) return true;
    return false;
  }

  /** Mark stream as permanently closed — no further reconnection. */
  close(): void {
    this._state = 'closed';
    this.inFlight.clear();
  }
}
