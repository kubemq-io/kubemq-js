import { randomUUID } from 'node:crypto';
import type { KubeMQError } from '../errors.js';
import type { MessageBody } from '../internal/utils/body.js';
import { normalizeBody } from '../internal/utils/body.js';
import { validateEventMessage } from '../internal/validation/message-validator.js';

export type { MessageBody };

/**
 * Outbound event message.
 *
 * @remarks
 * **Async safety:** Not safe for concurrent modification. Create a new instance
 * per send operation. Do not share outbound message objects between concurrent
 * async operations. Message objects are frozen (`Object.freeze()`) by factory
 * functions — modification after creation throws a `TypeError`.
 */
export interface EventMessage {
  readonly channel: string;
  readonly body?: MessageBody;
  readonly metadata?: string;
  readonly tags?: Record<string, string>;
  readonly id?: string;
  readonly clientId?: string;
}

/**
 * Received event from a subscription.
 *
 * @remarks
 * **Async safety:** Safe to read from multiple async contexts concurrently.
 * Do not modify received message objects — they are shared references from
 * the subscription's delivery pipeline. Fields are readonly.
 */
export interface EventReceived {
  readonly id: string;
  readonly channel: string;
  readonly timestamp: Date;
  readonly body: Uint8Array;
  readonly metadata: string;
  readonly tags: Record<string, string>;
}

/**
 * Subscription request for events.
 *
 * @remarks
 * **Async safety:** Subscription callbacks fire sequentially on the Node.js
 * event loop by default. Opt-in concurrent processing is available via
 * `maxConcurrentCallbacks` in `SubscriptionOptions`. When concurrency > 1,
 * message ordering is NOT guaranteed.
 */
export interface EventsSubscription {
  readonly channel: string;
  readonly group?: string;
  readonly onEvent: (event: EventReceived) => void;
  readonly onError: (err: KubeMQError) => void;
}

/**
 * Handle for a persistent event publishing stream (fire-and-forget).
 *
 * @remarks
 * Obtained from {@link KubeMQClient.createEventStream}. Keeps a single gRPC
 * bidirectional stream open for high-throughput publishing. The `send()` method
 * is synchronous (fire-and-forget) — errors are delivered asynchronously via
 * the `onError` handler.
 *
 * @see {@link KubeMQClient.createEventStream}
 * @see {@link EventMessage}
 */
export interface EventStreamHandle {
  /** Publish an event over the stream. Returns a Promise that resolves when the write buffer has capacity (backpressure-aware). */
  send(msg: EventMessage): Promise<void>;
  /** Register a handler for asynchronous stream errors. */
  onError(handler: (err: Error) => void): void;
  /** Close the stream and release resources. */
  close(): void;
  /** Whether the stream is still active. */
  readonly isActive: boolean;
}

/**
 * Create a validated, frozen EventMessage with defaults applied.
 *
 * - `id` defaults to a random UUID
 * - `metadata` defaults to `''`
 * - `tags` defaults to `{}`
 * - String/Buffer body is normalized to `Uint8Array`
 *
 * @example
 * ```typescript
 * const event = createEventMessage({
 *   channel: 'events.notifications',
 *   body: new TextEncoder().encode('hello world'),
 *   metadata: 'greeting',
 *   tags: { source: 'api' },
 * });
 * await client.sendEvent(event);
 * ```
 */
export function createEventMessage(
  opts: Omit<EventMessage, 'id'> & { id?: string },
): Readonly<EventMessage> {
  validateEventMessage(opts as EventMessage, 'createEventMessage');

  const msg: EventMessage = {
    channel: opts.channel,
    body: opts.body !== undefined ? normalizeBody(opts.body) : undefined,
    metadata: opts.metadata ?? '',
    tags: opts.tags ?? {},
    id: opts.id ?? randomUUID(),
    clientId: opts.clientId,
  };

  return Object.freeze(msg);
}
