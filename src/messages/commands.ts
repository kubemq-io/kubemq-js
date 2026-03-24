import { randomUUID } from 'node:crypto';
import type { KubeMQError } from '../errors.js';
import type { MessageBody } from '../internal/utils/body.js';
import { normalizeBody } from '../internal/utils/body.js';
import { validateCommandMessage } from '../internal/validation/message-validator.js';

/**
 * Outbound RPC command message.
 *
 * @remarks
 * **Async safety:** Not safe for concurrent modification. Create a new instance
 * per send operation. Do not share outbound message objects between concurrent
 * async operations. Message objects are frozen (`Object.freeze()`) by factory
 * functions — modification after creation throws a `TypeError`.
 */
export interface CommandMessage {
  readonly channel: string;
  readonly body?: MessageBody;
  readonly metadata?: string;
  readonly tags?: Record<string, string>;
  readonly timeoutInSeconds: number;
  readonly id?: string;
  readonly clientId?: string;
  readonly span?: Uint8Array;
}

/**
 * Received RPC command from a subscription.
 *
 * @remarks
 * **Async safety:** Safe to read from multiple async contexts concurrently.
 * Do not modify received message objects — they are shared references from
 * the subscription's delivery pipeline. Fields are readonly.
 */
export interface CommandReceived {
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
 * Response to an RPC command, indicating whether the command was executed.
 *
 * @remarks
 * Returned by {@link KubeMQClient.sendCommand} and sent back by command
 * subscribers via {@link KubeMQClient.sendCommandResponse}. Check the
 * `executed` flag to determine success.
 *
 * @see {@link KubeMQClient.sendCommand}
 * @see {@link KubeMQClient.sendCommandResponse}
 * @see {@link CommandReceived}
 */
export interface CommandResponse {
  /** Correlation ID linking the response to its originating command. */
  readonly id: string;
  /** Reply channel for routing the response back to the sender. */
  readonly replyChannel: string;
  /** Client ID of the responder. */
  readonly clientId?: string;
  /** Whether the command was successfully executed by the handler. */
  readonly executed: boolean;
  /** Error message from the handler, if execution failed. */
  readonly error?: string;
  /** Optional metadata returned with the response. */
  readonly metadata?: string;
  /** Optional response body payload. */
  readonly body?: Uint8Array;
  /** OpenTelemetry span context for distributed tracing. */
  readonly span?: Uint8Array;
  /** Key-value tags attached to the response. */
  readonly tags?: Record<string, string>;
  /** Server-side timestamp of the response. */
  readonly timestamp?: Date;
}

/**
 * Subscription request for RPC commands.
 *
 * @remarks
 * **Async safety:** Subscription callbacks fire sequentially on the Node.js
 * event loop by default. Opt-in concurrent processing is available via
 * `maxConcurrentCallbacks` in `SubscriptionOptions`. When concurrency > 1,
 * message ordering is NOT guaranteed.
 */
export interface CommandSubscription {
  readonly channel: string;
  readonly group?: string;
  readonly onCommand: (cmd: CommandReceived) => void;
  readonly onError: (err: KubeMQError) => void;
}

/**
 * Create a validated, frozen CommandMessage with defaults applied.
 *
 * - `id` defaults to a random UUID
 * - `metadata` defaults to `''`
 * - `tags` defaults to `{}`
 * - `timeoutInSeconds` is required and must be positive
 * - Requires at least one of: body, metadata, or tags
 * - String/Buffer body is normalized to `Uint8Array`
 *
 * @example
 * ```typescript
 * const cmd = createCommand({
 *   channel: 'commands.user-service',
 *   body: new TextEncoder().encode(JSON.stringify({ action: 'disable', userId: '42' })),
 *   timeoutInSeconds: 5,
 *   tags: { source: 'admin-panel' },
 * });
 * const response = await client.sendCommand(cmd);
 * ```
 */
export function createCommand(
  opts: Omit<CommandMessage, 'id'> & { id?: string },
): Readonly<CommandMessage> {
  validateCommandMessage(opts as CommandMessage, 'createCommand');

  const msg: CommandMessage = {
    channel: opts.channel,
    body: opts.body !== undefined ? normalizeBody(opts.body) : undefined,
    metadata: opts.metadata ?? '',
    tags: opts.tags ?? {},
    timeoutInSeconds: opts.timeoutInSeconds,
    id: opts.id ?? randomUUID(),
    clientId: opts.clientId,
  };

  return Object.freeze(msg);
}
