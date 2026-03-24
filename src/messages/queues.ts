import { randomUUID } from 'node:crypto';
import type { KubeMQError } from '../errors.js';
import type { MessageBody } from '../internal/utils/body.js';
import { normalizeBody } from '../internal/utils/body.js';
import { validateQueueMessage } from '../internal/validation/message-validator.js';

/**
 * Delivery policy for a queue message controlling expiration, delay, and dead-letter behavior.
 *
 * @remarks
 * Attach to a {@link QueueMessage} via the `policy` property.
 * When `maxReceiveCount` is exceeded, the message is routed to `maxReceiveQueue`
 * (dead-letter queue) if specified, otherwise it is discarded.
 *
 * @see {@link QueueMessage}
 * @see {@link KubeMQClient.sendQueueMessage}
 */
export interface QueueMessagePolicy {
  /** Time in seconds after which the message expires and is discarded. */
  readonly expirationSeconds?: number;
  /** Delay in seconds before the message becomes visible to consumers. */
  readonly delaySeconds?: number;
  /** Maximum number of delivery attempts before dead-lettering. */
  readonly maxReceiveCount?: number;
  /** Dead-letter queue channel. Messages exceeding `maxReceiveCount` are routed here. */
  readonly maxReceiveQueue?: string;
}

/**
 * Outbound queue message.
 *
 * @remarks
 * **Async safety:** Not safe for concurrent modification. Create a new instance
 * per send operation. Do not share outbound message objects between concurrent
 * async operations. Message objects are frozen (`Object.freeze()`) by factory
 * functions — modification after creation throws a `TypeError`.
 */
export interface QueueMessage {
  readonly channel: string;
  readonly body?: MessageBody;
  readonly metadata?: string;
  readonly tags?: Record<string, string>;
  readonly policy?: QueueMessagePolicy;
  readonly id?: string;
  readonly clientId?: string;
}

/**
 * Received queue message with acknowledgment methods.
 *
 * @remarks
 * **Async safety:** The `ack()`, `nack()`, and `reQueue()` methods are safe
 * to call from any async context, but each message MUST be acknowledged exactly
 * once. Calling `ack()` after `nack()` (or vice versa) throws a
 * `ValidationError`.
 */
export interface ReceivedQueueMessage {
  readonly id: string;
  readonly channel: string;
  readonly fromClientId: string;
  readonly body: Uint8Array;
  readonly metadata: string;
  readonly tags: Record<string, string>;
  readonly timestamp: Date;
  readonly sequence: number;
  readonly receiveCount: number;
  readonly isReRouted: boolean;
  readonly reRouteFromQueue?: string;
  readonly expiredAt?: Date;
  readonly delayedTo?: Date;

  ack(): Promise<void>;
  nack(): Promise<void>;
  reQueue(channel: string): Promise<void>;
}

/**
 * Request parameters for polling messages from a queue channel.
 *
 * @remarks
 * Used by {@link KubeMQClient.receiveQueueMessages} and
 * {@link KubeMQClient.peekQueueMessages}.
 *
 * @see {@link KubeMQClient.receiveQueueMessages}
 * @see {@link ReceivedQueueMessage}
 */
export interface QueuePollRequest {
  /** Queue channel to poll from. */
  readonly channel: string;
  /** Maximum time in seconds to wait for messages before returning an empty result. */
  readonly waitTimeoutSeconds: number;
  /** Maximum number of messages to receive in a single poll. Default: 1. */
  readonly maxMessages?: number;
  /**
   * Automatically acknowledge messages upon receipt. Default: `false`.
   * @remarks **No effect on the unary receive API** — messages are always auto-acked server-side.
   * Use {@link KubeMQClient.streamQueueMessages} for explicit ack/reject control.
   */
  readonly autoAck?: boolean;
}

/**
 * Result of a successful queue message send operation.
 *
 * @see {@link KubeMQClient.sendQueueMessage}
 * @see {@link QueueMessage}
 */
export interface QueueSendResult {
  /** Server-assigned message ID. */
  readonly messageId: string;
  /** Timestamp when the message was persisted by the server. */
  readonly sentAt: Date;
  /** When the message will expire, if an expiration policy was set. */
  readonly expirationAt?: Date;
  /** When the message becomes visible, if a delay policy was set. */
  readonly delayedTo?: Date;
}

/**
 * Result of a batch queue message send operation.
 *
 * @remarks
 * Each item in `results` corresponds to the message at the same index in
 * the original batch. Check individual `error` fields for per-message failures.
 *
 * @see {@link KubeMQClient.sendQueueMessagesBatch}
 * @see {@link QueueSendResult}
 */
export interface BatchSendResult {
  /** Per-message results, ordered by batch index. */
  readonly results: {
    /** Index of the message in the original batch array. */
    index: number;
    /** Server-assigned message ID on success. */
    messageId?: string;
    /** Error details if this particular message failed. */
    error?: KubeMQError;
  }[];
  /** Number of messages successfully sent. */
  readonly successCount: number;
  /** Number of messages that failed. */
  readonly failureCount: number;
}

/**
 * Options for batch send operations.
 *
 * @see {@link KubeMQClient.sendQueueMessagesBatch}
 */
export interface BatchSendOptions {
  /** Number of messages to include per batch request. */
  readonly batchSize?: number;
}

/**
 * Options for creating a streaming queue consumer via {@link KubeMQClient.streamQueueMessages}.
 *
 * @remarks
 * The streaming API provides transactional message processing with explicit
 * ack/reject/requeue per message or per batch, unlike the simple poll API.
 *
 * @see {@link KubeMQClient.streamQueueMessages}
 * @see {@link QueueStreamHandle}
 */
export interface QueueStreamOptions {
  /** Queue channel to consume from. */
  readonly channel: string;
  /** Time in seconds to wait for messages before the stream returns empty. */
  readonly waitTimeoutSeconds?: number;
  /** Maximum number of messages per batch. */
  readonly maxMessages?: number;
  /** Automatically acknowledge messages after delivery to the handler. */
  readonly autoAck?: boolean;
  /** Custom metadata key-value pairs sent with each downstream request. */
  readonly metadata?: Record<string, string>;
}

/**
 * A queue message received via the streaming API with synchronous settlement methods.
 *
 * @remarks
 * Unlike {@link ReceivedQueueMessage} (from the poll API), the streaming message's
 * `ack()`, `nack()`, and `reQueue()` methods are synchronous — they write to
 * the underlying gRPC stream without awaiting a response.
 *
 * Each message within a transaction must be settled exactly once.
 *
 * @see {@link QueueStreamHandle}
 * @see {@link ReceivedQueueMessage}
 */
export interface QueueStreamMessage {
  /** Server-assigned message ID. */
  readonly id: string;
  /** Channel the message was received from. */
  readonly channel: string;
  /** Raw message body. */
  readonly body: Uint8Array;
  /** Application metadata string. */
  readonly metadata: string;
  /** User-defined key-value tags. */
  readonly tags: Record<string, string>;
  /** Server-side timestamp when the message was enqueued. */
  readonly timestamp: Date;
  /** Monotonically increasing sequence number within the channel. */
  readonly sequence: number;
  /** Number of times this message has been delivered. */
  readonly receiveCount: number;
  /** MD5 hash of the body, if computed by the server. */
  readonly md5OfBody?: string;
  /** Whether this message was re-routed from another queue. */
  readonly isReRouted: boolean;
  /** Original queue channel if the message was re-routed. */
  readonly reRouteFromQueue?: string;
  /** Expiration timestamp, if an expiration policy was set. */
  readonly expiredAt?: Date;
  /** Delayed-until timestamp, if a delay policy was set. */
  readonly delayedTo?: Date;

  /** Acknowledge the message, removing it from the queue. */
  ack(): void;
  /** Reject (nack) the message, returning it to the queue for redelivery. */
  nack(): void;
  /** Move the message to a different queue channel. */
  reQueue(channel: string): void;
}

/**
 * Handle for an active streaming queue consumer, providing batch settlement and lifecycle control.
 *
 * @remarks
 * Obtained from {@link KubeMQClient.streamQueueMessages}. Register handlers
 * via `onMessages`, `onError`, and `onClose`, then settle messages individually
 * or in bulk. Call `close()` to gracefully shut down the stream.
 *
 * @see {@link KubeMQClient.streamQueueMessages}
 * @see {@link QueueStreamMessage}
 * @see {@link QueueStreamOptions}
 */
export interface QueueStreamHandle {
  /** Whether the stream is still active and accepting operations. */
  readonly isActive: boolean;
  /** Metadata returned by the most recent server response. */
  readonly responseMetadata: Record<string, string>;
  /** Register a handler invoked when a batch of messages is received. */
  onMessages(handler: (messages: QueueStreamMessage[]) => void): void;
  /** Register a handler invoked when a stream error occurs. */
  onError(handler: (err: Error) => void): void;
  /** Register a handler invoked when the stream closes. */
  onClose(handler: () => void): void;
  /** Gracefully close the stream and release resources. */
  close(): void;
  /** Acknowledge all messages in the current transaction. */
  ackAll(): void;
  /** Reject (nack) all messages in the current transaction. */
  nackAll(): void;
  /** Re-queue all messages in the current transaction to a different channel. */
  reQueueAll(channel: string): void;
  /** Acknowledge specific messages by their sequence numbers. */
  ackRange(sequences: number[]): void;
  /** Reject specific messages by their sequence numbers. */
  nackRange(sequences: number[]): void;
  /** Re-queue specific messages by their sequence numbers to a different channel. */
  reQueueRange(channel: string, sequences: number[]): void;
  /** @deprecated Not supported by the server — throws NotImplementedError. Reserved for future use. */
  getActiveOffsets(): Promise<number[]>;
  /** @deprecated Not supported by the server — throws NotImplementedError. Reserved for future use. */
  getTransactionStatus(): Promise<boolean>;
}

/**
 * Result of a queue upstream (streaming send) operation.
 *
 * @see {@link QueueUpstreamHandle}
 * @see {@link KubeMQClient.createQueueUpstream}
 */
export interface QueueUpstreamResult {
  /** Correlation ID matching the original request. */
  readonly requestId: string;
  /** Per-message send results within the batch. */
  readonly results: QueueSendResult[];
  /** Whether the upstream operation encountered an error. */
  readonly isError: boolean;
  /** Error description if `isError` is `true`. */
  readonly error?: string;
}

/**
 * Handle for a persistent upstream queue stream, enabling high-throughput batch sends.
 *
 * @remarks
 * Obtained from {@link KubeMQClient.createQueueUpstream}. Unlike
 * {@link KubeMQClient.sendQueueMessage}, the upstream stream keeps a
 * single gRPC bidirectional stream open for multiple send operations,
 * reducing per-message overhead.
 *
 * @see {@link KubeMQClient.createQueueUpstream}
 * @see {@link QueueUpstreamResult}
 */
export interface QueueUpstreamHandle {
  /** Send a batch of messages over the upstream stream. */
  send(msgs: QueueMessage[]): Promise<QueueUpstreamResult>;
  /** Close the upstream stream and release resources. */
  close(): void;
  /** Whether the stream is still active. */
  readonly isActive: boolean;
}

/**
 * A batch of messages from the queue streaming consumer, with batch-level settlement.
 *
 * @remarks
 * Yielded by the {@link KubeMQClient.consumeQueue} async iterator.
 * Settle the entire batch at once via `ackAll()`, `nackAll()`, or `reQueueAll()`.
 *
 * @see {@link KubeMQClient.consumeQueue}
 * @see {@link QueueStreamMessage}
 */
export interface QueueBatch {
  /** Messages in this batch. */
  readonly messages: QueueStreamMessage[];
  /** Server-assigned transaction ID for this batch. */
  readonly transactionId: string;
  /** Acknowledge all messages in the batch. */
  ackAll(): void;
  /** Reject all messages in the batch. */
  nackAll(): void;
  /** Re-queue all messages in the batch to a different channel. */
  reQueueAll(channel: string): void;
}

/**
 * Create a validated, frozen QueueMessage with defaults applied.
 *
 * - `id` defaults to a random UUID
 * - `metadata` defaults to `''`
 * - `tags` defaults to `{}`
 * - Nested `policy` is also frozen
 * - String/Buffer body is normalized to `Uint8Array`
 *
 * @example
 * ```typescript
 * const msg = createQueueMessage({
 *   channel: 'queues.orders',
 *   body: new TextEncoder().encode(JSON.stringify({ orderId: 123 })),
 *   tags: { priority: 'high' },
 *   policy: { expirationSeconds: 3600, maxReceiveCount: 3 },
 * });
 * const result = await client.sendQueueMessage(msg);
 * ```
 */
export function createQueueMessage(
  opts: Omit<QueueMessage, 'id'> & { id?: string },
): Readonly<QueueMessage> {
  validateQueueMessage(opts as QueueMessage, 'createQueueMessage');

  const msg: QueueMessage = {
    channel: opts.channel,
    body: opts.body !== undefined ? normalizeBody(opts.body) : undefined,
    metadata: opts.metadata ?? '',
    tags: opts.tags ?? {},
    policy: opts.policy ? Object.freeze({ ...opts.policy }) : undefined,
    id: opts.id ?? randomUUID(),
    clientId: opts.clientId,
  };

  return Object.freeze(msg);
}
