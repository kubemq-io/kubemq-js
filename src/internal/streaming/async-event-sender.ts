/**
 * @internal — Shared bidi streaming sender for events (fire-and-forget + store).
 *
 * Single persistent SendEventsStream per client. All channels share one stream.
 * Mirrors Python SDK's AsyncEventSender architecture.
 */
import { randomUUID } from 'node:crypto';
import { BaseStreamingSender } from './base-streaming-sender.js';
import type { BaseSenderOptions } from './base-streaming-sender.js';
import type { kubemq } from '../../protos/kubemq.js';

export type AsyncEventSenderOptions = BaseSenderOptions;

export class AsyncEventSender extends BaseStreamingSender<kubemq.Event, kubemq.Result, string> {
  protected grpcMethod(): string {
    return 'SendEventsStream';
  }

  protected extractRequestKey(request: kubemq.Event): string | null {
    if (!request.Store) return null;
    // Ensure store events always have an EventID for pending-map tracking
    if (!request.EventID) request.EventID = randomUUID();
    return request.EventID;
  }

  protected extractResponseKey(response: kubemq.Result): string | null {
    return response.EventID || null;
  }

  protected isResponseSuccess(response: kubemq.Result): boolean {
    return response.Sent ? true : false;
  }

  protected responseErrorMessage(response: kubemq.Result): string {
    return response.Error || 'Event store send failed';
  }

  /**
   * Send a store event. Returns a Promise that resolves when the server ACKs.
   */
  sendStore(event: kubemq.Event, deadline?: Date): Promise<kubemq.Result> {
    // enqueue with tracked=true always returns a Promise
    const p = this.enqueue(event, true, deadline);
    if (!p) throw new Error('unreachable: tracked enqueue returned undefined');
    return p;
  }

  /**
   * Send a fire-and-forget event. Returns void.
   * Throws BufferFullError if the queue is at capacity.
   */
  sendFireAndForget(event: kubemq.Event): void {
    void this.enqueue(event, false);
  }
}
