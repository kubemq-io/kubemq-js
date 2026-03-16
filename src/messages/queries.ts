import { randomUUID } from 'node:crypto';
import type { KubeMQError } from '../errors.js';
import type { MessageBody } from '../internal/utils/body.js';
import { normalizeBody } from '../internal/utils/body.js';
import { validateQueryMessage } from '../internal/validation/message-validator.js';

/**
 * Outbound RPC query message.
 *
 * @remarks
 * **Async safety:** Not safe for concurrent modification. Create a new instance
 * per send operation. Do not share outbound message objects between concurrent
 * async operations. Message objects are frozen (`Object.freeze()`) by factory
 * functions — modification after creation throws a `TypeError`.
 */
export interface QueryMessage {
  readonly channel: string;
  readonly body?: MessageBody;
  readonly metadata?: string;
  readonly tags?: Record<string, string>;
  readonly timeoutMs: number;
  readonly cacheKey?: string;
  readonly cacheTTL?: number;
  readonly id?: string;
  readonly clientId?: string;
  readonly span?: Uint8Array;
}

/**
 * Received RPC query from a subscription.
 *
 * @remarks
 * **Async safety:** Safe to read from multiple async contexts concurrently.
 * Do not modify received message objects — they are shared references from
 * the subscription's delivery pipeline. Fields are readonly.
 */
export interface ReceivedQuery {
  readonly id: string;
  readonly channel: string;
  readonly fromClientId: string;
  readonly timestamp: Date;
  readonly body: Uint8Array;
  readonly metadata: string;
  readonly replyChannel: string;
  readonly tags: Record<string, string>;
}

/**
 * Response to an RPC query, carrying the result data.
 *
 * @remarks
 * Returned by {@link KubeMQClient.sendQuery} and sent back by query
 * subscribers via {@link KubeMQClient.sendQueryResponse}. Check `executed`
 * for success, then read `body` for the result payload. The `cacheHit` flag
 * indicates whether the response was served from the server-side cache.
 *
 * @see {@link KubeMQClient.sendQuery}
 * @see {@link KubeMQClient.sendQueryResponse}
 * @see {@link ReceivedQuery}
 */
export interface QueryResponse {
  /** Correlation ID linking the response to its originating query. */
  readonly id: string;
  /** Reply channel for routing the response back to the sender. */
  readonly replyChannel: string;
  /** Client ID of the responder. */
  readonly clientId?: string;
  /** Whether the query was successfully executed by the handler. */
  readonly executed: boolean;
  /** Error message from the handler, if execution failed. */
  readonly error?: string;
  /** Optional metadata returned with the response. */
  readonly metadata?: string;
  /** Response body payload containing the query result. */
  readonly body?: Uint8Array;
  /** Key-value tags attached to the response. */
  readonly tags?: Record<string, string>;
  /** Server-side timestamp of the response. */
  readonly timestamp?: Date;
  /** Whether this response was served from the server-side query cache. */
  readonly cacheHit?: boolean;
  /** OpenTelemetry span context for distributed tracing. */
  readonly span?: Uint8Array;
}

/**
 * Subscription request for RPC queries.
 *
 * @remarks
 * **Async safety:** Subscription callbacks fire sequentially on the Node.js
 * event loop by default. Opt-in concurrent processing is available via
 * `maxConcurrentCallbacks` in `SubscriptionOptions`. When concurrency > 1,
 * message ordering is NOT guaranteed.
 */
export interface QuerySubscription {
  readonly channel: string;
  readonly group?: string;
  readonly onQuery: (query: ReceivedQuery) => void;
  readonly onError: (err: KubeMQError) => void;
}

/**
 * Create a validated, frozen QueryMessage with defaults applied.
 *
 * - `id` defaults to a random UUID
 * - `metadata` defaults to `''`
 * - `tags` defaults to `{}`
 * - `timeoutMs` is required and must be positive
 * - Requires at least one of: body, metadata, or tags
 * - String/Buffer body is normalized to `Uint8Array`
 *
 * @example
 * ```typescript
 * const query = createQuery({
 *   channel: 'queries.user-service',
 *   body: new TextEncoder().encode(JSON.stringify({ userId: '42' })),
 *   timeoutMs: 5000,
 *   cacheKey: 'user:42',
 *   cacheTTL: 60,
 * });
 * const response = await client.sendQuery(query);
 * ```
 */
export function createQuery(
  opts: Omit<QueryMessage, 'id'> & { id?: string },
): Readonly<QueryMessage> {
  validateQueryMessage(opts as QueryMessage, 'createQuery');

  const msg: QueryMessage = {
    channel: opts.channel,
    body: opts.body !== undefined ? normalizeBody(opts.body) : undefined,
    metadata: opts.metadata ?? '',
    tags: opts.tags ?? {},
    timeoutMs: opts.timeoutMs,
    cacheKey: opts.cacheKey,
    cacheTTL: opts.cacheTTL,
    id: opts.id ?? randomUUID(),
    clientId: opts.clientId,
  };

  return Object.freeze(msg);
}
