import { randomUUID } from 'node:crypto';
import type { KubeMQError } from '../errors.js';
import type { MessageBody } from '../internal/utils/body.js';
import { normalizeBody } from '../internal/utils/body.js';
import { validateEventStoreMessage } from '../internal/validation/message-validator.js';

/**
 * Subscription start position for event-store channels.
 *
 * @remarks
 * Determines where in the persisted event stream a new subscriber begins
 * receiving messages. Used in {@link EventStoreSubscription.startFrom}.
 *
 * @see {@link EventStoreSubscription}
 * @see {@link KubeMQClient.subscribeToEventsStore}
 */
export enum EventStoreType {
  /** Receive only events published after the subscription is created. */
  StartNewOnly = 1,
  /** Replay all events from the beginning of the stream. */
  StartFromFirst = 2,
  /** Start from the most recent event and receive new ones going forward. */
  StartFromLast = 3,
  /** Start at a specific sequence number (set via {@link EventStoreSubscription.startValue}). */
  StartAtSequence = 4,
  /** Start at a specific point in time (set via {@link EventStoreSubscription.startValue} as Unix epoch ms). */
  StartAtTime = 5,
  /** Start at a time delta in seconds from now (set via {@link EventStoreSubscription.startValue}). */
  StartAtTimeDelta = 6,
}

/**
 * Outbound persistent event message.
 *
 * @remarks
 * **Async safety:** Not safe for concurrent modification. Create a new instance
 * per send operation. Do not share outbound message objects between concurrent
 * async operations. Message objects are frozen (`Object.freeze()`) by factory
 * functions — modification after creation throws a `TypeError`.
 */
export interface EventStoreMessage {
  readonly channel: string;
  readonly body?: MessageBody;
  readonly metadata?: string;
  readonly tags?: Record<string, string>;
  readonly id?: string;
  readonly clientId?: string;
}

/**
 * Received persistent event from a subscription.
 *
 * @remarks
 * **Async safety:** Safe to read from multiple async contexts concurrently.
 * Do not modify received message objects — they are shared references from
 * the subscription's delivery pipeline. Fields are readonly.
 */
export interface ReceivedEventStore {
  readonly id: string;
  readonly channel: string;
  readonly timestamp: Date;
  readonly body: Uint8Array;
  readonly metadata: string;
  readonly tags: Record<string, string>;
  readonly sequence: number;
}

/**
 * Subscription request for persistent events.
 *
 * @remarks
 * **Async safety:** Subscription callbacks fire sequentially on the Node.js
 * event loop by default. Opt-in concurrent processing is available via
 * `maxConcurrentCallbacks` in `SubscriptionOptions`. When concurrency > 1,
 * message ordering is NOT guaranteed.
 */
export interface EventStoreSubscription {
  readonly channel: string;
  readonly group?: string;
  readonly startFrom: EventStoreType;
  readonly startValue?: number;
  readonly onMessage: (event: ReceivedEventStore) => void;
  readonly onError: (err: KubeMQError) => void;
}

/**
 * Handle for a persistent event-store publishing stream with delivery confirmation.
 *
 * @remarks
 * Obtained from {@link KubeMQClient.createEventStoreStream}. Unlike
 * {@link EventStreamHandle}, the `send()` method returns a `Promise`
 * that resolves when the server confirms persistence, or rejects on failure.
 *
 * @see {@link KubeMQClient.createEventStoreStream}
 * @see {@link EventStoreMessage}
 */
export interface EventStoreStreamHandle {
  /** Publish an event-store message. Resolves when the server confirms persistence. */
  send(msg: EventStoreMessage): Promise<void>;
  /** Register a handler for asynchronous stream errors. */
  onError(handler: (err: Error) => void): void;
  /** Close the stream and release resources. */
  close(): void;
  /** Whether the stream is still active. */
  readonly isActive: boolean;
}

/**
 * Create a validated, frozen EventStoreMessage with defaults applied.
 *
 * - `id` defaults to a random UUID
 * - `metadata` defaults to `''`
 * - `tags` defaults to `{}`
 * - String/Buffer body is normalized to `Uint8Array`
 *
 * @example
 * ```typescript
 * const event = createEventStoreMessage({
 *   channel: 'events-store.audit-log',
 *   body: new TextEncoder().encode(JSON.stringify({ action: 'login', userId: '42' })),
 *   tags: { service: 'auth' },
 * });
 * await client.publishEventStore(event);
 * ```
 */
export function createEventStoreMessage(
  opts: Omit<EventStoreMessage, 'id'> & { id?: string },
): Readonly<EventStoreMessage> {
  validateEventStoreMessage(opts as EventStoreMessage, 'createEventStoreMessage');

  const msg: EventStoreMessage = {
    channel: opts.channel,
    body: opts.body !== undefined ? normalizeBody(opts.body) : undefined,
    metadata: opts.metadata ?? '',
    tags: opts.tags ?? {},
    id: opts.id ?? randomUUID(),
    clientId: opts.clientId,
  };

  return Object.freeze(msg);
}
