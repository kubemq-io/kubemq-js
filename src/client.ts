import { randomUUID } from 'node:crypto';
import type {
  ClientOptions,
  OperationOptions,
  SubscriptionOptions,
  CloseOptions,
  RetryPolicy,
} from './options.js';
import type { EventMessage, EventReceived, EventsSubscription } from './messages/events.js';
import { EventStoreStartPosition } from './messages/events-store.js';
import type {
  EventStoreMessage,
  EventStoreReceived,
  EventStoreResult,
  EventStoreSubscription,
  EventStoreStreamHandle,
} from './messages/events-store.js';
import type { EventStreamHandle } from './messages/events.js';
import type {
  QueueMessage,
  ReceivedQueueMessage,
  QueuePollRequest,
  QueueSendResult,
  BatchSendResult,
  QueueStreamOptions,
  QueueStreamMessage,
  QueueStreamHandle,
  QueueUpstreamHandle,
  QueueUpstreamResult,
  QueueBatch,
} from './messages/queues.js';
import type {
  CommandMessage,
  CommandResponse,
  CommandSubscription,
  CommandReceived,
} from './messages/commands.js';
import type {
  QueryMessage,
  QueryResponse,
  QuerySubscription,
  QueryReceived,
} from './messages/queries.js';
import type { Subscription } from './messages/subscription.js';
import { ConnectionState } from './internal/transport/connection-state.js';
import type { ConnectionEventMap } from './internal/transport/typed-emitter.js';
import { GrpcTransport } from './internal/transport/grpc-transport.js';
import type { TransportCallOptions, StreamHandle } from './internal/transport/transport.js';
import { validateClientOptions } from './internal/config-validator.js';
import { applyDefaults } from './internal/config-defaults.js';
import type { ResolvedClientOptions } from './internal/config-defaults.js';
import {
  validateEventMessage,
  validateEventStoreMessage,
  validateQueueMessage,
  validateCommandMessage,
  validateQueryMessage,
  validateQueuePollRequest,
  validateSubscription,
  validateEventStoreSubscription,
  validateResponseMessage,
} from './internal/validation/message-validator.js';
import {
  NotImplementedError,
  ValidationError,
  TransientError,
  ErrorCode,
  KubeMQError,
} from './errors.js';
import {
  toProtoEvent,
  toProtoRequest,
  toProtoResponse,
  toProtoQueueMessage,
  toProtoSubscribeEvents,
  toProtoSubscribeEventsStore,
  toProtoSubscribeCommands,
  toProtoSubscribeQueries,
  toProtoReceiveQueueRequest,
  toProtoBatchRequest,
  toProtoQueuesDownstreamRequest,
  fromProtoPingResult,
  fromProtoResult,
  fromProtoEventStoreResult,
  fromProtoReceivedEvent,
  fromProtoReceivedEventStore,
  fromProtoReceivedCommand,
  fromProtoReceivedQuery,
  fromProtoCommandResponse,
  fromProtoQueryResponse,
  fromProtoBatchResponse,
  fromProtoReceiveQueueResponse,
  toProtoQueuesUpstreamRequest,
  fromProtoQueuesUpstreamResponse,
  fromTagsMap,
  toTagsMap,
} from './internal/protocol/marshaller.js';
import { GrpcSubscriptionHandle } from './internal/transport/subscription-handle.js';
import { mapGrpcError } from './internal/middleware/error-mapper.js';
import type { RawTransportError } from './internal/transport/transport.js';
import type { ChannelType, ChannelInfo } from './internal/protocol/channel-ops.js';
// eslint-disable-next-line no-restricted-imports -- client implementation requires proto types
import { kubemq } from './protos/kubemq.js';
import { CallbackDispatcher } from './internal/concurrency/callback-dispatcher.js';
import { AsyncEventSender } from './internal/streaming/async-event-sender.js';
import { AsyncUpstreamSender } from './internal/streaming/async-upstream-sender.js';
import { SenderClosedError } from './errors.js';
import { assertNodeVersion } from './internal/runtime-check.js';
import { withRetry, createRetryThrottle, resolveSignal, resolveSignalOptional, resolveDeadline } from './internal/middleware/retry.js';
import type { RetryThrottle, OperationType, RetryHooks } from './internal/middleware/retry.js';
import { TelemetryMiddleware } from './internal/middleware/telemetry.js';
import type { OperationKind, SpanConfig } from './internal/middleware/telemetry.js';
import { MetricsMiddleware } from './internal/middleware/metrics.js';

export type { ChannelType, ChannelInfo };
export type { ChannelStats } from './internal/protocol/channel-ops.js';

/**
 * Information about the connected KubeMQ server, returned by {@link KubeMQClient.ping}.
 *
 * @see {@link KubeMQClient.ping}
 */
export interface ServerInfo {
  /** Hostname or IP address of the server. */
  host: string;
  /** Server software version string. */
  version: string;
  /** Unix timestamp (seconds) when the server process started. */
  serverStartTime: number;
  /** Server uptime in seconds. */
  serverUpTime: number;
}

function validateChannelName(channel: string, operation: string): void {
  if (!channel || channel.trim().length === 0) {
    throw new ValidationError({
      code: ErrorCode.ValidationFailed,
      message: 'Channel name must not be empty',
      operation,
      isRetryable: false,
      suggestion: 'Provide a non-empty channel name',
    });
  }
}

/**
 * KubeMQ client for all messaging patterns.
 *
 * @remarks
 * **Async safety:** Safe for concurrent use from multiple async operations.
 * A single `KubeMQClient` instance should be shared across the application.
 * All methods are async and non-blocking. Concurrent calls to publish, send,
 * and subscribe methods are safe — the client serializes access to the
 * underlying gRPC channel internally.
 *
 * @remarks
 * **Lifecycle:** Create via `KubeMQClient.create()`, close via `close()` or
 * `await using`. Do not create multiple clients to the same server unless
 * you need isolated connection lifecycles.
 */
export class KubeMQClient implements AsyncDisposable {
  readonly #options: Readonly<ClientOptions>;
  readonly #resolved: ResolvedClientOptions;
  readonly #transport: GrpcTransport;
  readonly #activeDispatchers = new Set<CallbackDispatcher<unknown>>();
  readonly #retryPolicy: Readonly<RetryPolicy>;
  readonly #retryThrottle: RetryThrottle;
  readonly #telemetry: TelemetryMiddleware;
  readonly #metrics: MetricsMiddleware;
  #eventSenderPromise: Promise<AsyncEventSender> | null = null;
  #upstreamSenderPromise: Promise<AsyncUpstreamSender> | null = null;
  #closing = false;
  #closePromise: Promise<void> | null = null;

  private constructor(
    options: ClientOptions,
    resolved: ResolvedClientOptions,
    transport: GrpcTransport,
  ) {
    this.#options = Object.freeze({ ...options });
    this.#resolved = resolved;
    this.#transport = transport;
    this.#retryPolicy = resolved.retry;
    this.#retryThrottle = createRetryThrottle(resolved.maxConcurrentRetries);

    const sdkVersion = '3.0.0';
    this.#telemetry = new TelemetryMiddleware(resolved.logger, sdkVersion);
    this.#metrics = new MetricsMiddleware(resolved.logger, sdkVersion);
  }

  /** @internal — test-only factory that accepts any Transport-compatible object. */
  static _createForTesting(
    options: ClientOptions,
    resolved: ResolvedClientOptions,
    transport: GrpcTransport,
  ): KubeMQClient {
    return new KubeMQClient(options, resolved, transport);
  }

  // ─── Shared Streaming Senders (lazy init) ───

  #getEventSender(): Promise<AsyncEventSender> {
    if (this.#closing)
      throw new SenderClosedError({ message: 'Client is closing', operation: 'send' });
    if (!this.#eventSenderPromise) {
      this.#eventSenderPromise = Promise.resolve().then(() => {
        const sender = new AsyncEventSender({
          maxQueueSize: 10_000,
          logger: this.#resolved.logger,
          clientId: this.clientId,
        });
        sender.start(this.#transport);
        return sender;
      });
    }
    return this.#eventSenderPromise;
  }

  #getUpstreamSender(): Promise<AsyncUpstreamSender> {
    if (this.#closing)
      throw new SenderClosedError({ message: 'Client is closing', operation: 'send' });
    if (!this.#upstreamSenderPromise) {
      this.#upstreamSenderPromise = Promise.resolve().then(() => {
        const sender = new AsyncUpstreamSender({
          maxQueueSize: 10_000,
          logger: this.#resolved.logger,
          clientId: this.clientId,
        });
        sender.start(this.#transport);
        return sender;
      });
    }
    return this.#upstreamSenderPromise;
  }

  /** The raw user-provided options (frozen). */
  get options(): Readonly<ClientOptions> {
    return this.#options;
  }

  /** Auto-generated or user-provided client identifier. */
  get clientId(): string {
    return this.#resolved.clientId;
  }

  /** The server address this client connects to. */
  get address(): string {
    return this.#resolved.address;
  }

  /** Current connection state. */
  get state(): ConnectionState {
    return this.#transport.state;
  }

  /** Stats from the shared event sender (if initialized). */
  async getEventSenderStats(): Promise<
    import('./internal/streaming/base-streaming-sender.js').SenderStats | null
  > {
    if (!this.#eventSenderPromise) return null;
    const sender = await this.#eventSenderPromise.catch(() => null);
    return sender?.getStats() ?? null;
  }

  /** Stats from the shared queue upstream sender (if initialized). */
  async getUpstreamSenderStats(): Promise<
    import('./internal/streaming/base-streaming-sender.js').SenderStats | null
  > {
    if (!this.#upstreamSenderPromise) return null;
    const sender = await this.#upstreamSenderPromise.catch(() => null);
    return sender?.getStats() ?? null;
  }

  /**
   * Async factory — validates config, applies defaults, creates
   * transport, and connects before returning a ready client.
   *
   * @param options - Client configuration. Only `address` is required.
   * @returns A connected, ready-to-use client instance.
   * @throws {@link ConfigurationError} If `options` contain invalid values.
   * @throws {@link ConnectionError} If the initial connection fails.
   * @throws {@link AuthenticationError} If credentials are rejected during connect.
   *
   * @see {@link ClientOptions}
   */
  static async create(options: ClientOptions): Promise<KubeMQClient> {
    assertNodeVersion();
    validateClientOptions(options);
    const resolved = Object.freeze(applyDefaults(options));
    const transport = new GrpcTransport(options);
    await transport.connect();
    const client = new KubeMQClient(options, resolved, transport);
    await client.#telemetry.lazyLoadApi(options.tracerProvider);
    await client.#metrics.lazyLoadApi(options.meterProvider);

    transport.on('stateChange', (state: ConnectionState) => {
      if (state === ConnectionState.READY) {
        client.#metrics.recordConnectionChange(1);
      } else if (state === ConnectionState.CLOSED) {
        client.#metrics.recordConnectionChange(-1);
      } else if (state === ConnectionState.RECONNECTING) {
        client.#metrics.recordReconnectionAttempt();
      }
    });

    return client;
  }

  // ─── Connection Events ───

  /**
   * Register a listener for a connection lifecycle event.
   *
   * @param event - Event name from {@link ConnectionEventMap}.
   * @param listener - Callback invoked when the event fires.
   * @returns `this` for chaining.
   *
   * @see {@link ConnectionEventMap}
   * @see {@link KubeMQClient.off}
   */
  on<K extends keyof ConnectionEventMap>(event: K, listener: ConnectionEventMap[K]): this {
    this.#transport.getStateMachine().on(event, listener);
    return this;
  }

  /**
   * Remove a previously registered connection event listener.
   *
   * @param event - Event name from {@link ConnectionEventMap}.
   * @param listener - The exact listener function reference to remove.
   * @returns `this` for chaining.
   *
   * @see {@link ConnectionEventMap}
   * @see {@link KubeMQClient.on}
   */
  off<K extends keyof ConnectionEventMap>(event: K, listener: ConnectionEventMap[K]): this {
    this.#transport.getStateMachine().off(event, listener);
    return this;
  }

  // ─── Events ───

  /**
   * Send a fire-and-forget event to a channel.
   *
   * @example
   * ```typescript
   * const client = await KubeMQClient.create({ address: 'localhost:50000' });
   * await client.sendEvent({
   *   channel: 'events.notifications',
   *   body: new TextEncoder().encode('user signed up'),
   *   metadata: 'signup',
   *   tags: { userId: '42' },
   * });
   * ```
   *
   * @param msg - The event message to send.
   * @param opts - Optional timeout and cancellation overrides.
   * @throws {@link ValidationError} If the message fails validation (e.g. empty channel).
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link CancellationError} If cancelled via `opts.signal`.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link createEventMessage}
   * @see {@link subscribeToEvents}
   */
  async sendEvent(msg: EventMessage, _opts?: OperationOptions): Promise<void> {
    this.#transport.ensureNotClosed('sendEvent');
    validateEventMessage(msg, 'sendEvent');
    const pbEvent = toProtoEvent(msg, this.clientId, false);
    const span = this.#startSpan('publish', msg.channel, 3, {
      messageId: msg.id,
      bodySize: msg.body?.length,
    });
    const t0 = performance.now();

    try {
      const sender = await this.#getEventSender();
      sender.sendFireAndForget(pbEvent);
      this.#metrics.recordMessageSent({ operationName: 'sendEvent', channel: msg.channel });
      this.#telemetry.endSpan(span);
    } catch (err) {
      this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
      throw err;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'sendEvent',
        channel: msg.channel,
      });
    }
  }

  /**
   * Send a persistent event to an event-store channel.
   *
   * @param msg - The event-store message to send.
   * @param opts - Optional timeout and cancellation overrides.
   * @returns The send result with event ID and delivery status.
   * @throws {@link ValidationError} If the message fails validation.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link CancellationError} If cancelled via `opts.signal`.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link createEventStoreMessage}
   * @see {@link subscribeToEventsStore}
   * @see {@link EventStoreResult}
   */
  async sendEventStore(msg: EventStoreMessage, opts?: OperationOptions): Promise<EventStoreResult> {
    this.#transport.ensureNotClosed('sendEventStore');
    validateEventStoreMessage(msg, 'sendEventStore');
    const pbEvent = toProtoEvent(msg, this.clientId, true);
    const timeoutMs = opts?.timeout ?? this.#resolved.defaultSendTimeoutMs;
    const deadline = new Date(Date.now() + timeoutMs);
    const span = this.#startSpan('publish', msg.channel, 3, {
      messageId: msg.id,
      bodySize: msg.body?.length,
    });
    const t0 = performance.now();

    try {
      const sender = await this.#getEventSender();
      const result = await sender.sendStore(pbEvent, deadline);
      fromProtoResult(result, 'sendEventStore');
      const storeResult = fromProtoEventStoreResult(result);
      this.#metrics.recordMessageSent({ operationName: 'sendEventStore', channel: msg.channel });
      this.#telemetry.endSpan(span);
      return storeResult;
    } catch (err) {
      this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
      throw err;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'sendEventStore',
        channel: msg.channel,
      });
    }
  }

  /**
   * Subscribe to real-time events on a channel.
   *
   * @example
   * ```typescript
   * const client = await KubeMQClient.create({ address: 'localhost:50000' });
   * const sub = client.subscribeToEvents({
   *   channel: 'events.notifications',
   *   group: 'worker-group',
   *   onEvent: (event) => {
   *     console.log(`Received: ${event.id} on ${event.channel}`);
   *   },
   *   onError: (err) => console.error(err),
   * });
   *
   * // Later, cancel the subscription:
   * sub.cancel();
   * ```
   *
   * @param sub - Subscription request with channel, optional group, and callbacks.
   * @param opts - Optional concurrency, timeout, and cancellation overrides.
   * @returns A {@link Subscription} handle to cancel the subscription.
   * @throws {@link ValidationError} If the subscription request is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link sendEvent}
   * @see {@link Subscription}
   * @see {@link EventsSubscription}
   */
  subscribeToEvents(sub: EventsSubscription, opts?: SubscriptionOptions): Subscription {
    this.#transport.ensureNotClosed('subscribeToEvents');
    validateSubscription(sub, 'subscribeToEvents', true);

    // C3 fix: currentStream reference for backpressure pause/resume
    let currentStream: StreamHandle<never, kubemq.EventReceive> | undefined;

    const dispatcher = new CallbackDispatcher<EventReceived>({
      maxConcurrent: opts?.maxConcurrentCallbacks ?? 20,
      maxQueueDepth: opts?.maxQueueDepth,
      dropOnHighWater: opts?.dropOnHighWater,
      logger: this.#resolved.logger,
      onError: sub.onError,
      onHighWater: () => currentStream?.pause(),
      onLowWater: () => currentStream?.resume(),
    });
    this.#activeDispatchers.add(dispatcher as CallbackDispatcher<unknown>);

    const subId = randomUUID();
    const tracker = this.#transport.getSubscriptionTracker();

    const createAndAttachStream = () => {
      const pbSubscribe = toProtoSubscribeEvents(sub.channel, sub.group, this.clientId);
      const s = this.#transport.serverStream<kubemq.Subscribe, kubemq.EventReceive>(
        'SubscribeToEvents',
        pbSubscribe,
      );
      currentStream = s;
      s.onData((data: kubemq.EventReceive) => {
        const msg = fromProtoReceivedEvent(data);
        this.#metrics.recordMessageConsumed({
          operationName: 'subscribeToEvents',
          channel: sub.channel,
        });
        dispatcher.dispatch((m) => {
          const span = this.#startSpan('process', sub.channel, 4, { messageId: m.id });
          try {
            sub.onEvent(m);
            this.#telemetry.endSpan(span);
          } catch (err) {
            this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
            throw err;
          }
        }, msg);
      });
      s.onError((err: Error) => {
        const mapped = this.#mapStreamError(err, 'subscribeToEvents', sub.channel);
        sub.onError(mapped);
      });
      return s;
    };

    const stream = createAndAttachStream();
    const handle = new GrpcSubscriptionHandle(stream, this.#resolved.logger, 'subscribeToEvents');

    tracker.register({
      id: subId,
      pattern: 'events',
      channel: sub.channel,
      group: sub.group,
      resubscribe: () => {
        const newStream = createAndAttachStream();
        handle.rebind(newStream);
      },
    });

    const originalCancel = handle.cancel.bind(handle);
    handle.cancel = () => {
      tracker.unregister(subId);
      originalCancel();
      dispatcher.close();
      this.#activeDispatchers.delete(dispatcher as CallbackDispatcher<unknown>);
    };

    if (opts?.signal) {
      opts.signal.addEventListener(
        'abort',
        () => {
          handle.cancel();
        },
        { once: true },
      );
    }

    return handle;
  }

  /**
   * Subscribe to persistent events on an event-store channel.
   *
   * @remarks
   * Automatically resumes from the last received sequence on reconnection.
   *
   * @param sub - Subscription request with channel, start position, and callbacks.
   * @param opts - Optional concurrency, timeout, and cancellation overrides.
   * @returns A {@link Subscription} handle to cancel the subscription.
   * @throws {@link ValidationError} If the subscription request is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link sendEventStore}
   * @see {@link Subscription}
   * @see {@link EventStoreSubscription}
   * @see {@link EventStoreStartPosition}
   */
  subscribeToEventsStore(sub: EventStoreSubscription, opts?: SubscriptionOptions): Subscription {
    this.#transport.ensureNotClosed('subscribeToEventsStore');
    validateEventStoreSubscription(sub, 'subscribeToEventsStore');

    // C3 fix: currentStream reference for backpressure pause/resume
    let currentStream: StreamHandle<never, kubemq.EventReceive> | undefined;

    const dispatcher = new CallbackDispatcher<EventStoreReceived>({
      maxConcurrent: opts?.maxConcurrentCallbacks ?? 20,
      maxQueueDepth: opts?.maxQueueDepth,
      dropOnHighWater: opts?.dropOnHighWater,
      logger: this.#resolved.logger,
      onError: sub.onError,
      onHighWater: () => currentStream?.pause(),
      onLowWater: () => currentStream?.resume(),
    });
    this.#activeDispatchers.add(dispatcher as CallbackDispatcher<unknown>);

    const subId = randomUUID();
    const tracker = this.#transport.getSubscriptionTracker();

    const createAndAttachStream = () => {
      const tracked = tracker.get(subId);
      let effectiveSub: EventStoreSubscription = sub;
      if (tracked?.lastSequence != null) {
        effectiveSub = {
          ...sub,
          startFrom: EventStoreStartPosition.StartAtSequence,
          startValue: tracked.lastSequence + 1,
        };
      }
      const pbSubscribe = toProtoSubscribeEventsStore(effectiveSub, this.clientId);
      const s = this.#transport.serverStream<kubemq.Subscribe, kubemq.EventReceive>(
        'SubscribeToEvents',
        pbSubscribe,
      );
      currentStream = s;
      s.onData((data: kubemq.EventReceive) => {
        const msg = fromProtoReceivedEventStore(data);
        tracker.updateSequence(subId, msg.sequence);
        this.#metrics.recordMessageConsumed({
          operationName: 'subscribeToEventsStore',
          channel: sub.channel,
        });
        dispatcher.dispatch((m) => {
          const span = this.#startSpan('process', sub.channel, 4, { messageId: m.id });
          try {
            sub.onEvent(m);
            this.#telemetry.endSpan(span);
          } catch (err) {
            this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
            throw err;
          }
        }, msg);
      });
      s.onError((err: Error) => {
        const mapped = this.#mapStreamError(err, 'subscribeToEventsStore', sub.channel);
        sub.onError(mapped);
      });
      return s;
    };

    const stream = createAndAttachStream();
    const handle = new GrpcSubscriptionHandle(
      stream,
      this.#resolved.logger,
      'subscribeToEventsStore',
    );

    tracker.register({
      id: subId,
      pattern: 'events-store',
      channel: sub.channel,
      group: sub.group,
      resubscribe: () => {
        const newStream = createAndAttachStream();
        handle.rebind(newStream);
      },
    });

    const originalCancel = handle.cancel.bind(handle);
    handle.cancel = () => {
      tracker.unregister(subId);
      originalCancel();
      dispatcher.close();
      this.#activeDispatchers.delete(dispatcher as CallbackDispatcher<unknown>);
    };

    if (opts?.signal) {
      opts.signal.addEventListener(
        'abort',
        () => {
          handle.cancel();
        },
        { once: true },
      );
    }

    return handle;
  }

  // ─── Queues ───

  /**
   * Send a message to a queue channel.
   *
   * @example
   * ```typescript
   * const client = await KubeMQClient.create({ address: 'localhost:50000' });
   * const result = await client.sendQueueMessage({
   *   channel: 'queues.orders',
   *   body: new TextEncoder().encode(JSON.stringify({ orderId: 123 })),
   *   tags: { priority: 'high' },
   *   policy: { expirationSeconds: 3600 },
   * });
   * console.log(`Sent message ${result.messageId} at ${result.sentAt}`);
   * ```
   *
   * @param msg - The queue message to send.
   * @param opts - Optional timeout and cancellation overrides.
   * @returns The send result with message ID and timestamps.
   * @throws {@link ValidationError} If the message fails validation.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link CancellationError} If cancelled via `opts.signal`.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link createQueueMessage}
   * @see {@link receiveQueueMessages}
   * @see {@link QueueSendResult}
   */
  async sendQueueMessage(msg: QueueMessage, opts?: OperationOptions): Promise<QueueSendResult> {
    this.#transport.ensureNotClosed('sendQueueMessage');
    validateQueueMessage(msg, 'sendQueueMessage');
    const timeoutMs = opts?.timeout ?? this.#resolved.defaultSendTimeoutMs;
    const deadline = new Date(Date.now() + timeoutMs);
    const span = this.#startSpan('publish', msg.channel, 3, {
      messageId: msg.id,
      bodySize: msg.body?.length,
    });
    const t0 = performance.now();

    try {
      const sender = await this.#getUpstreamSender();
      const upstreamReq = toProtoQueuesUpstreamRequest([msg], this.clientId);
      const response = await sender.send(upstreamReq, deadline);
      const parsed = fromProtoQueuesUpstreamResponse(response, 'sendQueueMessage');
      const result = parsed.results[0] ?? { messageId: msg.id ?? '', sentAt: new Date() };
      this.#metrics.recordMessageSent({ operationName: 'sendQueueMessage', channel: msg.channel });
      this.#telemetry.endSpan(span);
      return result;
    } catch (err) {
      this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
      throw err;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'sendQueueMessage',
        channel: msg.channel,
      });
    }
  }

  /**
   * Send multiple queue messages in a single batch request.
   *
   * @param msgs - Array of queue messages to send. Must contain at least one message.
   * @param opts - Optional timeout and cancellation overrides.
   * @returns Batch result with per-message outcomes and aggregate counts.
   * @throws {@link ValidationError} If the array is empty or any message fails validation.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link sendQueueMessage}
   * @see {@link BatchSendResult}
   */
  async sendQueueMessagesBatch(
    msgs: QueueMessage[],
    opts?: OperationOptions,
  ): Promise<BatchSendResult> {
    this.#transport.ensureNotClosed('sendQueueMessagesBatch');
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive: JS callers may pass null
    if (!msgs || msgs.length === 0) {
      throw new ValidationError({
        code: ErrorCode.ValidationFailed,
        message: 'Messages array is required and must not be empty',
        operation: 'sendQueueMessagesBatch',
        isRetryable: false,
      });
    }
    if (msgs.length === 0) {
      throw new ValidationError({
        code: ErrorCode.ValidationFailed,
        message: 'Batch must contain at least one message',
        operation: 'sendQueueMessagesBatch',
        isRetryable: false,
      });
    }
    for (const msg of msgs) {
      validateQueueMessage(msg, 'sendQueueMessagesBatch');
    }
    const pbMsgs = msgs.map((m) => toProtoQueueMessage(m, this.clientId));
    const batchReq = toProtoBatchRequest(pbMsgs);
    const signal = resolveSignal(this.#resolved.defaultSendTimeoutMs, opts);

    const channel = msgs[0]?.channel;
    const span = this.#startSpan('publish', channel ?? '', 3, { batchCount: msgs.length });
    const t0 = performance.now();

    try {
      const result = await withRetry(
        async (sig) => {
          const response = await this.#transport.unaryCall<
            kubemq.QueueMessagesBatchRequest,
            kubemq.QueueMessagesBatchResponse
          >('SendQueueMessagesBatch', batchReq, { signal: sig });
          return fromProtoBatchResponse(response);
        },
        this.#retryPolicy,
        {
          operation: 'sendQueueMessagesBatch',
          operationType: 'queueSend' as OperationType,
          channel,
          serverAddress: this.address,
        },
        this.#resolved.logger,
        this.#retryThrottle,
        signal,
        this.#retryHooks('sendQueueMessagesBatch', channel),
      );
      this.#metrics.recordMessageSent(
        { operationName: 'sendQueueMessagesBatch', channel },
        msgs.length,
      );
      this.#telemetry.endSpan(span);
      return result;
    } catch (err) {
      this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
      throw err;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'sendQueueMessagesBatch',
        channel,
      });
    }
  }

  /**
   * Receive (poll) messages from a queue channel.
   *
   * @example
   * ```typescript
   * const client = await KubeMQClient.create({ address: 'localhost:50000' });
   * const messages = await client.receiveQueueMessages({
   *   channel: 'queues.orders',
   *   maxMessages: 10,
   *   waitTimeoutSeconds: 5,
   * });
   * for (const msg of messages) {
   *   console.log(`Processing ${msg.id}: ${new TextDecoder().decode(msg.body)}`);
   *   await msg.ack();
   * }
   * ```
   *
   * @param req - Poll parameters including channel, max messages, and wait timeout.
   * @param opts - Optional timeout and cancellation overrides.
   * @returns Array of received messages with `ack()` / `nack()` methods.
   * @throws {@link ValidationError} If the poll request is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link sendQueueMessage}
   * @see {@link streamQueueMessages}
   * @see {@link QueuePollRequest}
   * @see {@link ReceivedQueueMessage}
   */
  async receiveQueueMessages(
    req: QueuePollRequest,
    opts?: OperationOptions,
  ): Promise<ReceivedQueueMessage[]> {
    this.#transport.ensureNotClosed('receiveQueueMessages');
    validateQueuePollRequest(req, 'receiveQueueMessages');
    const pbReq = toProtoReceiveQueueRequest(req, this.clientId);
    const signal = resolveSignal(this.#resolved.defaultQueueReceiveTimeoutMs, opts);

    const span = this.#startSpan('receive', req.channel, 4);
    const t0 = performance.now();

    let rawMessages: Awaited<ReturnType<typeof fromProtoReceiveQueueResponse>>;
    try {
      rawMessages = await withRetry(
        async (sig) => {
          const response = await this.#transport.unaryCall<
            kubemq.ReceiveQueueMessagesRequest,
            kubemq.ReceiveQueueMessagesResponse
          >('ReceiveQueueMessages', pbReq, { signal: sig });
          return fromProtoReceiveQueueResponse(response, 'receiveQueueMessages');
        },
        this.#retryPolicy,
        {
          operation: 'receiveQueueMessages',
          operationType: 'queueReceive',
          channel: req.channel,
          serverAddress: this.address,
        },
        this.#resolved.logger,
        this.#retryThrottle,
        signal,
        this.#retryHooks('receiveQueueMessages', req.channel),
      );
      this.#metrics.recordMessageConsumed(
        { operationName: 'receiveQueueMessages', channel: req.channel },
        rawMessages.length,
      );
      this.#telemetry.endSpan(span);
    } catch (err) {
      this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
      throw err;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'receiveQueueMessages',
        channel: req.channel,
      });
    }

    return rawMessages.map((raw) => ({
      ...raw,
      ack: async () => {
        /* auto-acked by simple receive API */
      },
      nack: async () => {
        /* no-op for simple receive API */
      },
      reQueue: (_channel: string) => {
        throw new NotImplementedError({
          code: ErrorCode.NotImplemented,
          message: 'reQueue is not supported via simple receive — use the streaming queue API',
          operation: 'reQueue',
          isRetryable: false,
          suggestion: 'Use QueuesDownstream streaming for per-message requeue',
        });
      },
    }));
  }

  /**
   * Open a streaming queue consumer for transactional message processing.
   *
   * @remarks
   * Uses a bidirectional gRPC stream for low-latency, transactional
   * message consumption with per-message or batch ack/reject/requeue.
   *
   * @param opts - Stream options including channel and auto-ack behavior.
   * @returns A {@link QueueStreamHandle} for receiving and settling messages.
   * @throws {@link ValidationError} If the channel name is empty.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link receiveQueueMessages}
   * @see {@link consumeQueue}
   * @see {@link QueueStreamHandle}
   * @see {@link QueueStreamOptions}
   */
  streamQueueMessages(opts: QueueStreamOptions): QueueStreamHandle {
    this.#transport.ensureNotClosed('streamQueueMessages');
    validateChannelName(opts.channel, 'streamQueueMessages');

    let stream = this.#transport.duplexStream<
      kubemq.QueuesDownstreamRequest,
      kubemq.QueuesDownstreamResponse
    >('QueuesDownstream');

    let active = true;
    let msgHandler: ((msgs: QueueStreamMessage[]) => void) | undefined;
    let errHandler: ((err: Error) => void) | undefined;
    let closeHandler: (() => void) | undefined;
    // Design: single active transaction at a time. scheduleRePoll() ensures
    // sequential Get → Settle → Get flow. Concurrent transactions are not supported.
    let activeTransactionId: string | undefined;
    let lastResponseMetadata: Record<string, string> = {};

    const clientId = this.clientId;
    const tracker = this.#transport.getSubscriptionTracker();

    const writeDownstream = (reqType: number, extra?: Partial<Record<string, unknown>>) => {
      if (!active) return;
      /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
      const req = new kubemq.QueuesDownstreamRequest({
        RequestID: randomUUID(),
        ClientID: clientId,
        Channel: opts.channel,
        RequestTypeData: reqType,
        RefTransactionId: activeTransactionId ?? '',
        ...extra,
      } as any);
      /* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
      stream.write(req);
    };

    const scheduleRePoll = () => {
      if (!active) return;
      // Use setTimeout(0) instead of queueMicrotask so that close() (which sets
      // active=false via a microtask/await continuation) runs before the re-poll.
      // With queueMicrotask, a nack() → close() sequence would re-poll before the
      // close fires, re-acquiring the nacked message in a new transaction.
      setTimeout(() => {
        if (!active) return;
        const rePoll = toProtoQueuesDownstreamRequest(opts, clientId);
        stream.write(rePoll);
      }, 0);
    };

    const attachStreamHandlers = () => {
      /* eslint-disable @typescript-eslint/no-unsafe-enum-comparison, @typescript-eslint/no-unnecessary-condition */
      stream.onData((data: kubemq.QueuesDownstreamResponse) => {
        if (data.RequestTypeData === 11) {
          active = false;
          activeTransactionId = undefined;
          stream.end();
          if (closeHandler) closeHandler();
          return;
        }

        if (!active || data.IsError) {
          if (data.IsError && errHandler) {
            errHandler(new Error(data.Error || 'Queue downstream error'));
          }
          return;
        }

        // Only process Get responses (type 1). Settlement confirmations (types 2-7)
        // carry zero messages and must be discarded — otherwise batchSize=0 triggers
        // a premature scheduleRePoll() while the prior transaction is still open,
        // causing broker re-deliveries. Go/Python/Java all filter here.
        if (data.RequestTypeData !== 0 && data.RequestTypeData !== 1) {
          return;
        }

        activeTransactionId = data.TransactionId;
        if (data.Metadata instanceof Map) {
          const md: Record<string, string> = {};
          data.Metadata.forEach((v, k) => {
            md[k] = v;
          });
          lastResponseMetadata = md;
        }

        // C2 fix: per-message settled flag + batch completion tracker
        const rawMessages = data.Messages || [];
        const batchSize = rawMessages.length;
        let settledCount = 0;

        const onMessageSettled = () => {
          settledCount++;
          if (settledCount === batchSize) {
            // All messages in the batch are settled — clear transaction and re-poll
            activeTransactionId = undefined;
            scheduleRePoll();
          }
        };

        /* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-conversion */
        const messages: QueueStreamMessage[] = rawMessages.map((msg) => {
          const attrs = msg.Attributes;
          let msgSettled = false; // per-message flag (C2 fix)
          return {
            id: msg.MessageID,
            channel: msg.Channel,
            body: msg.Body instanceof Uint8Array ? msg.Body : new Uint8Array(0),
            metadata: msg.Metadata,
            tags: fromTagsMap(msg.Tags),
            timestamp: attrs ? new Date(Number(attrs.Timestamp) / 1_000_000) : new Date(),
            sequence: attrs ? Number(attrs.Sequence) : 0,
            receiveCount: attrs ? attrs.ReceiveCount : 0,
            md5OfBody: attrs?.MD5OfBody || undefined,
            isReRouted: attrs?.ReRouted ?? false,
            reRouteFromQueue: attrs?.ReRoutedFromQueue || undefined,
            expiredAt: attrs?.ExpirationAt ? new Date(Number(attrs.ExpirationAt) / 1e6) : undefined,
            delayedTo: attrs?.DelayedTo ? new Date(Number(attrs.DelayedTo) / 1e6) : undefined,
            ack() {
              // H3 fix: silently ignore settlement in autoAck mode
              if (opts.autoAck) return;
              if (!active || msgSettled) return;
              msgSettled = true;
              // C1 fix: use AckRange (3) instead of AckAll (2)
              stream.write(
                new kubemq.QueuesDownstreamRequest({
                  RequestID: randomUUID(),
                  ClientID: clientId,
                  Channel: opts.channel,
                  RequestTypeData: 3,
                  RefTransactionId: data.TransactionId,
                  SequenceRange: [Number(attrs?.Sequence ?? 0)],
                }),
              );
              onMessageSettled();
            },
            nack() {
              if (opts.autoAck) return;
              if (!active || msgSettled) return;
              msgSettled = true;
              // C1 fix: use NAckRange (5) instead of NAckAll (4)
              stream.write(
                new kubemq.QueuesDownstreamRequest({
                  RequestID: randomUUID(),
                  ClientID: clientId,
                  Channel: opts.channel,
                  RequestTypeData: 5,
                  RefTransactionId: data.TransactionId,
                  SequenceRange: [Number(attrs?.Sequence ?? 0)],
                }),
              );
              onMessageSettled();
            },
            reQueue(targetChannel: string) {
              if (opts.autoAck) return;
              if (!active || msgSettled) return;
              msgSettled = true;
              // C1 fix: use ReQueueRange (7) instead of ReQueueAll (6)
              stream.write(
                new kubemq.QueuesDownstreamRequest({
                  RequestID: randomUUID(),
                  ClientID: clientId,
                  ReQueueChannel: targetChannel,
                  RequestTypeData: 7,
                  RefTransactionId: data.TransactionId,
                  SequenceRange: [Number(attrs?.Sequence ?? 0)],
                }),
              );
              onMessageSettled();
            },
          };
        });

        /* eslint-enable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-conversion */
        if (messages.length > 0 && msgHandler) {
          msgHandler(messages);
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- active is mutated in callbacks
        if (active && opts.autoAck) {
          scheduleRePoll();
        }
        // For manual-ack mode: re-poll on empty-batch responses (server timeout with no messages).
        // Without this, the stream would go idle after an empty response since onMessageSettled
        // is never called when batchSize=0.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- active is mutated in callbacks
        if (active && !opts.autoAck && batchSize === 0) {
          scheduleRePoll();
        }
      });
      /* eslint-enable @typescript-eslint/no-unsafe-enum-comparison */

      stream.onError((err: Error) => {
        if (!active) return;
        active = false;
        if (errHandler) errHandler(err);
      });

      stream.onEnd(() => {
        if (!active) return;
        active = false;
        if (closeHandler) closeHandler();
      });
    };

    attachStreamHandlers();

    const pbReq = toProtoQueuesDownstreamRequest(opts, this.clientId);
    stream.write(pbReq);

    const subId = randomUUID();
    tracker.register({
      id: subId,
      pattern: 'queue-stream',
      channel: opts.channel,
      resubscribe: () => {
        if (!active) return;
        stream = this.#transport.duplexStream<
          kubemq.QueuesDownstreamRequest,
          kubemq.QueuesDownstreamResponse
        >('QueuesDownstream');
        attachStreamHandlers();
        const rePoll = toProtoQueuesDownstreamRequest(opts, clientId);
        stream.write(rePoll);
      },
    });

    return {
      get isActive() {
        return active;
      },
      get responseMetadata() {
        return lastResponseMetadata;
      },
      onMessages(handler) {
        msgHandler = handler;
      },
      onError(handler) {
        errHandler = handler;
      },
      onClose(handler) {
        closeHandler = handler;
      },
      ackAll() {
        writeDownstream(2);
        scheduleRePoll();
      },
      nackAll() {
        writeDownstream(4);
      },
      reQueueAll(channel: string) {
        writeDownstream(6, { ReQueueChannel: channel });
        scheduleRePoll();
      },
      ackRange(sequences: number[]) {
        writeDownstream(3, { SequenceRange: sequences });
        scheduleRePoll();
      },
      nackRange(sequences: number[]) {
        writeDownstream(5, { SequenceRange: sequences });
      },
      reQueueRange(channel: string, sequences: number[]) {
        writeDownstream(7, { ReQueueChannel: channel, SequenceRange: sequences });
        scheduleRePoll();
      },
      getActiveOffsets(): Promise<number[]> {
        // H1 fix: server never responds to ActiveOffsets (type 8) — throw instead of hanging
        throw new NotImplementedError({
          code: ErrorCode.NotImplemented,
          message: 'ActiveOffsets is not supported by the server',
          operation: 'getActiveOffsets',
          isRetryable: false,
          suggestion: 'This operation is reserved for future use.',
        });
      },
      getTransactionStatus(): Promise<boolean> {
        // H1 fix: server never responds to TransactionStatus (type 9) — throw instead of hanging
        throw new NotImplementedError({
          code: ErrorCode.NotImplemented,
          message: 'TransactionStatus is not supported by the server',
          operation: 'getTransactionStatus',
          isRetryable: false,
          suggestion: 'This operation is reserved for future use.',
        });
      },
      close() {
        if (!active) return;
        active = false;
        tracker.unregister(subId);
        stream.write(
          new kubemq.QueuesDownstreamRequest({
            RequestID: randomUUID(),
            ClientID: clientId,
            Channel: opts.channel,
            RequestTypeData: 10,
            RefTransactionId: activeTransactionId ?? '',
          }),
        );
        activeTransactionId = undefined;
        stream.end();
      },
    };
  }

  /**
   * Peek at messages in a queue without consuming them.
   *
   * @remarks
   * Returns copies of the messages that remain in the queue.
   * The `ack()`, `nack()`, and `reQueue()` methods on the returned
   * messages are no-ops.
   *
   * @param req - Poll parameters including channel and max messages.
   * @param opts - Optional timeout and cancellation overrides.
   * @returns Array of messages currently in the queue.
   * @throws {@link ValidationError} If the poll request is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link receiveQueueMessages}
   * @see {@link QueuePollRequest}
   */
  async peekQueueMessages(
    req: QueuePollRequest,
    opts?: OperationOptions,
  ): Promise<ReceivedQueueMessage[]> {
    this.#transport.ensureNotClosed('peekQueueMessages');
    validateQueuePollRequest(req, 'peekQueueMessages');
    const pbReq = toProtoReceiveQueueRequest(req, this.clientId);
    pbReq.IsPeak = true;
    const signal = resolveSignal(this.#resolved.defaultQueueReceiveTimeoutMs, opts);

    const span = this.#startSpan('receive', req.channel, 4);
    const t0 = performance.now();

    let rawMessages: Awaited<ReturnType<typeof fromProtoReceiveQueueResponse>>;
    try {
      rawMessages = await withRetry(
        async (sig) => {
          const response = await this.#transport.unaryCall<
            kubemq.ReceiveQueueMessagesRequest,
            kubemq.ReceiveQueueMessagesResponse
          >('ReceiveQueueMessages', pbReq, { signal: sig });
          return fromProtoReceiveQueueResponse(response, 'peekQueueMessages');
        },
        this.#retryPolicy,
        {
          operation: 'peekQueueMessages',
          operationType: 'queueSend' as OperationType,
          channel: req.channel,
          serverAddress: this.address,
        },
        this.#resolved.logger,
        this.#retryThrottle,
        signal,
        this.#retryHooks('peekQueueMessages', req.channel),
      );
      this.#telemetry.endSpan(span);
    } catch (err) {
      this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
      throw err;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'peekQueueMessages',
        channel: req.channel,
      });
    }

    return rawMessages.map((raw) => ({
      ...raw,
      ack: async () => {
        /* no-op for peek */
      },
      nack: async () => {
        /* no-op for peek */
      },
      reQueue: async () => {
        /* no-op for peek */
      },
    }));
  }

  // ─── RPC Commands ───

  /**
   * Send an RPC command and wait for a response.
   *
   * @example
   * ```typescript
   * const client = await KubeMQClient.create({ address: 'localhost:50000' });
   * const response = await client.sendCommand({
   *   channel: 'commands.user-service',
   *   body: new TextEncoder().encode(JSON.stringify({ action: 'disable', userId: '42' })),
   *   timeoutInSeconds: 5,
   * });
   * console.log(`Executed: ${response.executed}`);
   * ```
   *
   * @param msg - The command message including channel, body, and timeout.
   * @param opts - Optional timeout and cancellation overrides.
   * @returns The command response indicating whether execution succeeded.
   * @throws {@link ValidationError} If the command message is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link CancellationError} If cancelled via `opts.signal`.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link createCommand}
   * @see {@link subscribeToCommands}
   * @see {@link sendCommandResponse}
   * @see {@link CommandResponse}
   */
  async sendCommand(msg: CommandMessage, opts?: OperationOptions): Promise<CommandResponse> {
    this.#transport.ensureNotClosed('sendCommand');
    validateCommandMessage(msg, 'sendCommand');
    const pbReq = toProtoRequest(msg, this.clientId, 'Command');
    const signal = resolveSignalOptional(opts);
    const deadline = resolveDeadline(this.#resolved.defaultRpcTimeoutMs, opts);
    const span = this.#startSpan('send', msg.channel, 2, {
      messageId: msg.id,
      bodySize: msg.body?.length,
    });
    const t0 = performance.now();

    try {
      const result = await withRetry(
        async (sig) => {
          const response = await this.#transport.unaryCall<kubemq.Request, kubemq.Response>(
            'SendRequest',
            pbReq,
            { signal: signal ? sig : undefined, deadline },
          );
          return fromProtoCommandResponse(response);
        },
        this.#retryPolicy,
        {
          operation: 'sendCommand',
          operationType: 'command' as OperationType,
          channel: msg.channel,
          serverAddress: this.address,
        },
        this.#resolved.logger,
        this.#retryThrottle,
        signal,
        this.#retryHooks('sendCommand', msg.channel),
      );
      this.#metrics.recordMessageSent({ operationName: 'sendCommand', channel: msg.channel });
      this.#telemetry.endSpan(span);
      return result;
    } catch (err) {
      const mapped =
        err instanceof KubeMQError
          ? err
          : this.#mapStreamError(err as Error, 'sendCommand', msg.channel);
      this.#telemetry.endSpan(span, mapped);
      throw mapped;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'sendCommand',
        channel: msg.channel,
      });
    }
  }

  /**
   * Send an RPC query and wait for a response with data.
   *
   * @example
   * ```typescript
   * const client = await KubeMQClient.create({ address: 'localhost:50000' });
   * const response = await client.sendQuery({
   *   channel: 'queries.user-service',
   *   body: new TextEncoder().encode(JSON.stringify({ userId: '42' })),
   *   timeoutInSeconds: 5,
   * });
   * if (response.executed && response.body) {
   *   const user = JSON.parse(new TextDecoder().decode(response.body));
   *   console.log(`User: ${user.name}`);
   * }
   * ```
   *
   * @param msg - The query message including channel, body, and timeout.
   * @param opts - Optional timeout and cancellation overrides.
   * @returns The query response with execution status and optional result body.
   * @throws {@link ValidationError} If the query message is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link CancellationError} If cancelled via `opts.signal`.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link createQuery}
   * @see {@link subscribeToQueries}
   * @see {@link sendQueryResponse}
   * @see {@link QueryResponse}
   */
  async sendQuery(msg: QueryMessage, opts?: OperationOptions): Promise<QueryResponse> {
    this.#transport.ensureNotClosed('sendQuery');
    validateQueryMessage(msg, 'sendQuery');
    const pbReq = toProtoRequest(msg, this.clientId, 'Query');
    const signal = resolveSignalOptional(opts);
    const deadline = resolveDeadline(this.#resolved.defaultRpcTimeoutMs, opts);
    const span = this.#startSpan('send', msg.channel, 2, {
      messageId: msg.id,
      bodySize: msg.body?.length,
    });
    const t0 = performance.now();

    try {
      const result = await withRetry(
        async (sig) => {
          const response = await this.#transport.unaryCall<kubemq.Request, kubemq.Response>(
            'SendRequest',
            pbReq,
            { signal: signal ? sig : undefined, deadline },
          );
          return fromProtoQueryResponse(response);
        },
        this.#retryPolicy,
        {
          operation: 'sendQuery',
          operationType: 'query' as OperationType,
          channel: msg.channel,
          serverAddress: this.address,
        },
        this.#resolved.logger,
        this.#retryThrottle,
        signal,
        this.#retryHooks('sendQuery', msg.channel),
      );
      this.#metrics.recordMessageSent({ operationName: 'sendQuery', channel: msg.channel });
      this.#telemetry.endSpan(span);
      return result;
    } catch (err) {
      const mapped =
        err instanceof KubeMQError
          ? err
          : this.#mapStreamError(err as Error, 'sendQuery', msg.channel);
      this.#telemetry.endSpan(span, mapped);
      throw mapped;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'sendQuery',
        channel: msg.channel,
      });
    }
  }

  /**
   * Subscribe to incoming RPC commands on a channel.
   *
   * @param sub - Subscription request with channel, optional group, and command handler.
   * @param opts - Optional concurrency, timeout, and cancellation overrides.
   * @returns A {@link Subscription} handle to cancel the subscription.
   * @throws {@link ValidationError} If the subscription request is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link sendCommand}
   * @see {@link sendCommandResponse}
   * @see {@link CommandSubscription}
   * @see {@link Subscription}
   */
  subscribeToCommands(sub: CommandSubscription, opts?: SubscriptionOptions): Subscription {
    this.#transport.ensureNotClosed('subscribeToCommands');
    validateSubscription(sub, 'subscribeToCommands');

    // C3 fix: currentStream reference for backpressure pause/resume
    let currentStream: StreamHandle<never, kubemq.Request> | undefined;

    const dispatcher = new CallbackDispatcher<CommandReceived>({
      maxConcurrent: opts?.maxConcurrentCallbacks ?? 20,
      maxQueueDepth: opts?.maxQueueDepth,
      dropOnHighWater: opts?.dropOnHighWater,
      logger: this.#resolved.logger,
      onError: sub.onError,
      onHighWater: () => currentStream?.pause(),
      onLowWater: () => currentStream?.resume(),
    });
    this.#activeDispatchers.add(dispatcher as CallbackDispatcher<unknown>);

    const subId = randomUUID();
    const tracker = this.#transport.getSubscriptionTracker();

    const createAndAttachStream = () => {
      const pbSubscribe = toProtoSubscribeCommands(sub.channel, sub.group, this.clientId);
      const s = this.#transport.serverStream<kubemq.Subscribe, kubemq.Request>(
        'SubscribeToRequests',
        pbSubscribe,
      );
      currentStream = s;
      s.onData((data: kubemq.Request) => {
        const msg = fromProtoReceivedCommand(data);
        this.#metrics.recordMessageConsumed({
          operationName: 'subscribeToCommands',
          channel: sub.channel,
        });
        dispatcher.dispatch(async (m) => {
          const span = this.#startSpan('process', sub.channel, 4, { messageId: m.id });
          try {
            await sub.onCommand(m);
            this.#telemetry.endSpan(span);
          } catch (err) {
            this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
            throw err;
          }
        }, msg);
      });
      s.onError((err: Error) => {
        const mapped = this.#mapStreamError(err, 'subscribeToCommands', sub.channel);
        sub.onError(mapped);
      });
      return s;
    };

    const stream = createAndAttachStream();
    const handle = new GrpcSubscriptionHandle(stream, this.#resolved.logger, 'subscribeToCommands');

    tracker.register({
      id: subId,
      pattern: 'commands',
      channel: sub.channel,
      group: sub.group,
      resubscribe: () => {
        const newStream = createAndAttachStream();
        handle.rebind(newStream);
      },
    });

    const originalCancel = handle.cancel.bind(handle);
    handle.cancel = () => {
      tracker.unregister(subId);
      originalCancel();
      dispatcher.close();
      this.#activeDispatchers.delete(dispatcher as CallbackDispatcher<unknown>);
    };

    if (opts?.signal) {
      opts.signal.addEventListener(
        'abort',
        () => {
          handle.cancel();
        },
        { once: true },
      );
    }

    return handle;
  }

  /**
   * Subscribe to incoming RPC queries on a channel.
   *
   * @param sub - Subscription request with channel, optional group, and query handler.
   * @param opts - Optional concurrency, timeout, and cancellation overrides.
   * @returns A {@link Subscription} handle to cancel the subscription.
   * @throws {@link ValidationError} If the subscription request is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link sendQuery}
   * @see {@link sendQueryResponse}
   * @see {@link QuerySubscription}
   * @see {@link Subscription}
   */
  subscribeToQueries(sub: QuerySubscription, opts?: SubscriptionOptions): Subscription {
    this.#transport.ensureNotClosed('subscribeToQueries');
    validateSubscription(sub, 'subscribeToQueries');

    // C3 fix: currentStream reference for backpressure pause/resume
    let currentStream: StreamHandle<never, kubemq.Request> | undefined;

    const dispatcher = new CallbackDispatcher<QueryReceived>({
      maxConcurrent: opts?.maxConcurrentCallbacks ?? 20,
      maxQueueDepth: opts?.maxQueueDepth,
      dropOnHighWater: opts?.dropOnHighWater,
      logger: this.#resolved.logger,
      onError: sub.onError,
      onHighWater: () => currentStream?.pause(),
      onLowWater: () => currentStream?.resume(),
    });
    this.#activeDispatchers.add(dispatcher as CallbackDispatcher<unknown>);

    const subId = randomUUID();
    const tracker = this.#transport.getSubscriptionTracker();

    const createAndAttachStream = () => {
      const pbSubscribe = toProtoSubscribeQueries(sub.channel, sub.group, this.clientId);
      const s = this.#transport.serverStream<kubemq.Subscribe, kubemq.Request>(
        'SubscribeToRequests',
        pbSubscribe,
      );
      currentStream = s;
      s.onData((data: kubemq.Request) => {
        const msg = fromProtoReceivedQuery(data);
        this.#metrics.recordMessageConsumed({
          operationName: 'subscribeToQueries',
          channel: sub.channel,
        });
        dispatcher.dispatch(async (m) => {
          const span = this.#startSpan('process', sub.channel, 4, { messageId: m.id });
          try {
            await sub.onQuery(m);
            this.#telemetry.endSpan(span);
          } catch (err) {
            this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
            throw err;
          }
        }, msg);
      });
      s.onError((err: Error) => {
        const mapped = this.#mapStreamError(err, 'subscribeToQueries', sub.channel);
        sub.onError(mapped);
      });
      return s;
    };

    const stream = createAndAttachStream();
    const handle = new GrpcSubscriptionHandle(stream, this.#resolved.logger, 'subscribeToQueries');

    tracker.register({
      id: subId,
      pattern: 'queries',
      channel: sub.channel,
      group: sub.group,
      resubscribe: () => {
        const newStream = createAndAttachStream();
        handle.rebind(newStream);
      },
    });

    const originalCancel = handle.cancel.bind(handle);
    handle.cancel = () => {
      tracker.unregister(subId);
      originalCancel();
      dispatcher.close();
      this.#activeDispatchers.delete(dispatcher as CallbackDispatcher<unknown>);
    };

    if (opts?.signal) {
      opts.signal.addEventListener(
        'abort',
        () => {
          handle.cancel();
        },
        { once: true },
      );
    }

    return handle;
  }

  /**
   * Send a response to a received RPC command.
   *
   * @param resp - The response indicating execution success/failure.
   * @param opts - Optional timeout and cancellation overrides.
   * @throws {@link ValidationError} If the response is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link subscribeToCommands}
   * @see {@link sendCommand}
   * @see {@link CommandResponse}
   */
  async sendCommandResponse(resp: CommandResponse, opts?: OperationOptions): Promise<void> {
    this.#transport.ensureNotClosed('sendCommandResponse');
    validateResponseMessage(resp, 'sendCommandResponse');
    const pbResp = toProtoResponse(resp, this.clientId);
    const signal = resolveSignalOptional(opts);
    const deadline = resolveDeadline(this.#resolved.defaultRpcTimeoutMs, opts);
    const span = this.#startSpan('process', resp.replyChannel, 1);
    const t0 = performance.now();

    try {
      await withRetry(
        async (sig) => {
          await this.#transport.unaryCall<kubemq.Response, kubemq.Empty>('SendResponse', pbResp, {
            signal: signal ? sig : undefined,
            deadline,
          });
        },
        this.#retryPolicy,
        {
          operation: 'sendCommandResponse',
          operationType: 'command' as OperationType,
          channel: resp.replyChannel,
          serverAddress: this.address,
        },
        this.#resolved.logger,
        this.#retryThrottle,
        signal,
        this.#retryHooks('sendCommandResponse', resp.replyChannel),
      );
      this.#telemetry.endSpan(span);
    } catch (err) {
      this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
      throw err;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'sendCommandResponse',
        channel: resp.replyChannel,
      });
    }
  }

  /**
   * Send a response to a received RPC query.
   *
   * @param resp - The response containing result data.
   * @param opts - Optional timeout and cancellation overrides.
   * @throws {@link ValidationError} If the response is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link subscribeToQueries}
   * @see {@link sendQuery}
   * @see {@link QueryResponse}
   */
  async sendQueryResponse(resp: QueryResponse, opts?: OperationOptions): Promise<void> {
    this.#transport.ensureNotClosed('sendQueryResponse');
    validateResponseMessage(resp, 'sendQueryResponse');
    const pbResp = toProtoResponse(resp, this.clientId);
    const signal = resolveSignalOptional(opts);
    const deadline = resolveDeadline(this.#resolved.defaultRpcTimeoutMs, opts);
    const span = this.#startSpan('process', resp.replyChannel, 1);
    const t0 = performance.now();

    try {
      await withRetry(
        async (sig) => {
          await this.#transport.unaryCall<kubemq.Response, kubemq.Empty>('SendResponse', pbResp, {
            signal: signal ? sig : undefined,
            deadline,
          });
        },
        this.#retryPolicy,
        {
          operation: 'sendQueryResponse',
          operationType: 'query' as OperationType,
          channel: resp.replyChannel,
          serverAddress: this.address,
        },
        this.#resolved.logger,
        this.#retryThrottle,
        signal,
        this.#retryHooks('sendQueryResponse', resp.replyChannel),
      );
      this.#telemetry.endSpan(span);
    } catch (err) {
      this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
      throw err;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'sendQueryResponse',
        channel: resp.replyChannel,
      });
    }
  }

  // ─── Fast-path Response Methods ───

  /**
   * Send a command response directly, bypassing retry and telemetry overhead.
   *
   * Use this when responding to high-throughput commands where latency matters
   * more than retry safety. Responses are idempotent and time-critical — retrying
   * a late response is worse than dropping it.
   *
   * @param resp - The command response to send.
   * @param opts - Optional timeout override.
   * @throws {@link ValidationError} If the response is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link sendCommandResponse} for the full-featured version with retry and telemetry.
   */
  async sendCommandResponseDirect(resp: CommandResponse, opts?: OperationOptions): Promise<void> {
    this.#transport.ensureNotClosed('sendCommandResponseDirect');
    validateResponseMessage(resp, 'sendCommandResponseDirect');
    const pbResp = toProtoResponse(resp, this.clientId);
    const deadline = resolveDeadline(this.#resolved.defaultRpcTimeoutMs, opts);
    await this.#transport.unaryCall<kubemq.Response, kubemq.Empty>('SendResponse', pbResp, {
      deadline,
      signal: opts?.signal,
    });
  }

  /**
   * Send a query response directly, bypassing retry and telemetry overhead.
   *
   * Use this when responding to high-throughput queries where latency matters
   * more than retry safety. Responses are idempotent and time-critical — retrying
   * a late response is worse than dropping it.
   *
   * @param resp - The query response to send.
   * @param opts - Optional timeout override.
   * @throws {@link ValidationError} If the response is invalid.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link sendQueryResponse} for the full-featured version with retry and telemetry.
   */
  async sendQueryResponseDirect(resp: QueryResponse, opts?: OperationOptions): Promise<void> {
    this.#transport.ensureNotClosed('sendQueryResponseDirect');
    validateResponseMessage(resp, 'sendQueryResponseDirect');
    const pbResp = toProtoResponse(resp, this.clientId);
    const deadline = resolveDeadline(this.#resolved.defaultRpcTimeoutMs, opts);
    await this.#transport.unaryCall<kubemq.Response, kubemq.Empty>('SendResponse', pbResp, {
      deadline,
      signal: opts?.signal,
    });
  }

  // ─── Channel Management (REQ-API-2) ───

  /**
   * Create a channel on the KubeMQ server.
   *
   * @param channelName - Name of the channel to create.
   * @param channelType - The channel type (events, events_store, commands, queries, queues).
   * @throws {@link ValidationError} If the channel name is empty.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link deleteChannel}
   * @see {@link listChannels}
   * @see {@link ChannelType}
   */
  async createChannel(channelName: string, channelType: ChannelType): Promise<void> {
    this.#transport.ensureNotClosed('createChannel');
    validateChannelName(channelName, 'createChannel');
    const pbReq = new kubemq.Request({
      RequestID: randomUUID(),
      RequestTypeData: 2,
      Channel: 'kubemq.cluster.internal.requests',
      ClientID: this.clientId,
      Metadata: 'create-channel',
      Timeout: 10000,
      Tags: toTagsMap({
        channel_type: channelType,
        channel: channelName,
        client_id: this.clientId,
      }),
    });
    await this.#transport.unaryCall<kubemq.Request, kubemq.Response>(
      'SendRequest',
      pbReq,
      this.#buildCallOptions(),
    );
  }

  /**
   * Delete a channel from the KubeMQ server.
   *
   * @param channelName - Name of the channel to delete.
   * @param channelType - The channel type.
   * @throws {@link ValidationError} If the channel name is empty.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link createChannel}
   * @see {@link listChannels}
   */
  async deleteChannel(channelName: string, channelType: ChannelType): Promise<void> {
    this.#transport.ensureNotClosed('deleteChannel');
    validateChannelName(channelName, 'deleteChannel');
    const pbReq = new kubemq.Request({
      RequestID: randomUUID(),
      RequestTypeData: 2,
      Channel: 'kubemq.cluster.internal.requests',
      ClientID: this.clientId,
      Metadata: 'delete-channel',
      Timeout: 10000,
      Tags: toTagsMap({
        channel_type: channelType,
        channel: channelName,
      }),
    });
    await this.#transport.unaryCall<kubemq.Request, kubemq.Response>(
      'SendRequest',
      pbReq,
      this.#buildCallOptions(),
    );
  }

  /**
   * List channels of a given type, with optional name search filter.
   *
   * @param channelType - The channel type to list.
   * @param search - Optional substring filter applied to channel names.
   * @returns Array of channel metadata and statistics.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link TransientError} If the server cluster snapshot is not ready.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link createChannel}
   * @see {@link deleteChannel}
   * @see {@link ChannelInfo}
   */
  async listChannels(channelType: ChannelType, search?: string): Promise<ChannelInfo[]> {
    this.#transport.ensureNotClosed('listChannels');
    const tags: Record<string, string> = {
      channel_type: channelType,
    };
    if (search) {
      tags.channel_search = search;
    }

    const signal = resolveSignal(this.#resolved.defaultSendTimeoutMs);
    return withRetry(
      async (sig) => {
        const pbReq = new kubemq.Request({
          RequestID: randomUUID(),
          RequestTypeData: 2,
          Channel: 'kubemq.cluster.internal.requests',
          ClientID: this.clientId,
          Metadata: 'list-channels',
          Timeout: 10000,
          Tags: toTagsMap(tags),
        });
        const response = await this.#transport.unaryCall<kubemq.Request, kubemq.Response>(
          'SendRequest',
          pbReq,
          { signal: sig },
        );
        if (response.Error.includes('cluster snapshot not ready')) {
          throw new TransientError({
            code: ErrorCode.Unavailable,
            message: 'Cluster snapshot not ready yet — the server is still initializing',
            operation: 'listChannels',
            isRetryable: true,
            suggestion:
              'Retry after a short delay; the cluster needs time to build its snapshot after startup',
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!response.Body || response.Body.length === 0) {
          return [];
        }
        return JSON.parse(new TextDecoder().decode(response.Body)) as ChannelInfo[];
      },
      this.#retryPolicy,
      {
        operation: 'listChannels',
        operationType: 'send' as OperationType,
        channel: channelType,
        serverAddress: this.address,
      },
      this.#resolved.logger,
      this.#retryThrottle,
      signal,
      this.#retryHooks('listChannels', channelType),
    );
  }

  /** Convenience alias for `createChannel(name, 'events')`. @see {@link createChannel} */
  createEventsChannel(name: string): Promise<void> {
    return this.createChannel(name, 'events');
  }
  /** Convenience alias for `createChannel(name, 'events_store')`. @see {@link createChannel} */
  createEventsStoreChannel(name: string): Promise<void> {
    return this.createChannel(name, 'events_store');
  }
  /** Convenience alias for `createChannel(name, 'commands')`. @see {@link createChannel} */
  createCommandsChannel(name: string): Promise<void> {
    return this.createChannel(name, 'commands');
  }
  /** Convenience alias for `createChannel(name, 'queries')`. @see {@link createChannel} */
  createQueriesChannel(name: string): Promise<void> {
    return this.createChannel(name, 'queries');
  }
  /** Convenience alias for `createChannel(name, 'queues')`. @see {@link createChannel} */
  createQueuesChannel(name: string): Promise<void> {
    return this.createChannel(name, 'queues');
  }

  /** Convenience alias for `deleteChannel(name, 'events')`. @see {@link deleteChannel} */
  deleteEventsChannel(name: string): Promise<void> {
    return this.deleteChannel(name, 'events');
  }
  /** Convenience alias for `deleteChannel(name, 'events_store')`. @see {@link deleteChannel} */
  deleteEventsStoreChannel(name: string): Promise<void> {
    return this.deleteChannel(name, 'events_store');
  }
  /** Convenience alias for `deleteChannel(name, 'commands')`. @see {@link deleteChannel} */
  deleteCommandsChannel(name: string): Promise<void> {
    return this.deleteChannel(name, 'commands');
  }
  /** Convenience alias for `deleteChannel(name, 'queries')`. @see {@link deleteChannel} */
  deleteQueriesChannel(name: string): Promise<void> {
    return this.deleteChannel(name, 'queries');
  }
  /** Convenience alias for `deleteChannel(name, 'queues')`. @see {@link deleteChannel} */
  deleteQueuesChannel(name: string): Promise<void> {
    return this.deleteChannel(name, 'queues');
  }

  /** Convenience alias for `listChannels('events', search)`. @see {@link listChannels} */
  listEventsChannels(search?: string): Promise<ChannelInfo[]> {
    return this.listChannels('events', search);
  }
  /** Convenience alias for `listChannels('events_store', search)`. @see {@link listChannels} */
  listEventsStoreChannels(search?: string): Promise<ChannelInfo[]> {
    return this.listChannels('events_store', search);
  }
  /** Convenience alias for `listChannels('commands', search)`. @see {@link listChannels} */
  listCommandsChannels(search?: string): Promise<ChannelInfo[]> {
    return this.listChannels('commands', search);
  }
  /** Convenience alias for `listChannels('queries', search)`. @see {@link listChannels} */
  listQueriesChannels(search?: string): Promise<ChannelInfo[]> {
    return this.listChannels('queries', search);
  }
  /** Convenience alias for `listChannels('queues', search)`. @see {@link listChannels} */
  listQueuesChannels(search?: string): Promise<ChannelInfo[]> {
    return this.listChannels('queues', search);
  }

  // ─── Lifecycle ───

  /**
   * Gracefully close the client, draining in-flight callbacks and transport.
   *
   * @remarks
   * Waits for active subscription callbacks to complete (up to `callbackTimeoutSeconds`),
   * then closes the gRPC transport. After `close()`, all further operations throw
   * {@link ClientClosedError}. Also triggered by `await using` (AsyncDisposable).
   *
   * @param opts - Optional drain timeouts.
   * @see {@link CloseOptions}
   */
  close(opts?: CloseOptions): Promise<void> {
    this.#closePromise ??= this.#doClose(opts);
    return this.#closePromise;
  }

  async #doClose(opts?: CloseOptions): Promise<void> {
    // Prevent new sender creation during shutdown
    this.#closing = true;

    const callbackTimeoutMs =
      opts?.callbackTimeoutSeconds != null ? opts.callbackTimeoutSeconds * 1000 : 30_000;

    // Drain all active callback dispatchers before transport close
    if (this.#activeDispatchers.size > 0) {
      const drainAll = Promise.all(Array.from(this.#activeDispatchers).map((d) => d.drain()));
      await Promise.race([
        drainAll,
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, callbackTimeoutMs);
          if (typeof timer === 'object' && 'unref' in timer) {
            timer.unref();
          }
        }),
      ]);

      for (const dispatcher of this.#activeDispatchers) {
        dispatcher.close();
      }
      this.#activeDispatchers.clear();
    }

    // Shut down shared streaming senders before transport close
    if (this.#eventSenderPromise) {
      const sender = await this.#eventSenderPromise.catch(() => null);
      await sender?.close(5000);
    }
    if (this.#upstreamSenderPromise) {
      const sender = await this.#upstreamSenderPromise.catch(() => null);
      await sender?.close(5000);
    }

    await this.#transport.close(
      opts?.timeoutSeconds != null ? opts.timeoutSeconds * 1000 : undefined,
    );
  }

  /**
   * Ping the server and retrieve server information.
   *
   * @param opts - Optional timeout and cancellation overrides.
   * @returns Server metadata including host, version, and uptime.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQTimeoutError} If the operation exceeds the configured timeout.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link ServerInfo}
   */
  async ping(opts?: OperationOptions): Promise<ServerInfo> {
    this.#transport.ensureNotClosed('ping');
    const signal = resolveSignal(this.#resolved.defaultSendTimeoutMs, opts);
    const t0 = performance.now();

    try {
      return await withRetry(
        async (sig) => {
          const result = await this.#transport.unaryCall<kubemq.Empty, kubemq.PingResult>(
            'Ping',
            new kubemq.Empty(),
            { signal: sig },
          );
          return fromProtoPingResult(result);
        },
        this.#retryPolicy,
        {
          operation: 'ping',
          operationType: 'events' as OperationType,
          serverAddress: this.address,
        },
        this.#resolved.logger,
        this.#retryThrottle,
        signal,
        this.#retryHooks('ping'),
      );
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'ping',
      });
    }
  }

  // ─── Queue Ack All / Purge ───

  /**
   * Acknowledge all pending messages in a queue channel.
   *
   * @param channel - Queue channel name.
   * @param waitTimeSeconds - Seconds to wait for messages to settle. Default: 1.
   * @param opts - Optional timeout and cancellation overrides.
   * @returns Number of messages acknowledged.
   * @throws {@link ValidationError} If the channel name is empty.
   * @throws {@link ClientClosedError} If the client has been closed.
   * @throws {@link KubeMQError} If the server reports an error.
   * @throws {@link RetryExhaustedError} If all retry attempts fail.
   *
   * @see {@link purgeQueue}
   */
  async ackAllQueueMessages(
    channel: string,
    waitTimeSeconds = 1,
    opts?: OperationOptions,
  ): Promise<number> {
    this.#transport.ensureNotClosed('ackAllQueueMessages');
    validateChannelName(channel, 'ackAllQueueMessages');
    const pbReq = new kubemq.AckAllQueueMessagesRequest({
      RequestID: randomUUID(),
      ClientID: this.clientId,
      Channel: channel,
      WaitTimeSeconds: waitTimeSeconds,
    });
    const signal = resolveSignal(this.#resolved.defaultSendTimeoutMs, opts);

    const span = this.#startSpan('settle', channel, 4);
    const t0 = performance.now();

    try {
      let affected = 0;
      await withRetry(
        async (sig) => {
          const response = await this.#transport.unaryCall<
            kubemq.AckAllQueueMessagesRequest,
            kubemq.AckAllQueueMessagesResponse
          >('AckAllQueueMessages', pbReq, { signal: sig });
          if (response.IsError) {
            throw new KubeMQError({
              code: ErrorCode.Fatal,
              message: response.Error || 'ackAllQueueMessages failed',
              operation: 'ackAllQueueMessages',
              channel,
              isRetryable: false,
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          affected = response.AffectedMessages ?? 0;
        },
        this.#retryPolicy,
        {
          operation: 'ackAllQueueMessages',
          operationType: 'queueSend' as OperationType,
          channel,
          serverAddress: this.address,
        },
        this.#resolved.logger,
        this.#retryThrottle,
        signal,
        this.#retryHooks('ackAllQueueMessages', channel),
      );
      this.#telemetry.endSpan(span);
      return affected;
    } catch (err) {
      this.#telemetry.endSpan(span, err instanceof KubeMQError ? err : undefined);
      throw err;
    } finally {
      this.#metrics.recordOperationDuration((performance.now() - t0) / 1000, {
        operationName: 'ackAllQueueMessages',
        channel,
      });
    }
  }

  /**
   * Purge all pending messages from a queue channel by acknowledging them.
   *
   * @param channel - Queue channel name to purge.
   * @param opts - Optional timeout and cancellation overrides.
   *
   * @see {@link ackAllQueueMessages}
   */
  async purgeQueue(channel: string, opts?: OperationOptions): Promise<void> {
    await this.ackAllQueueMessages(channel, 1, opts);
  }

  // ─── Queue Upstream Stream (GAP-01) ───

  /**
   * Create a persistent upstream queue stream for high-throughput batch sends.
   *
   * @remarks
   * Keeps a single bidirectional gRPC stream open for multiple send operations,
   * reducing per-message connection overhead compared to {@link sendQueueMessage}.
   *
   * @returns A {@link QueueUpstreamHandle} for sending batches and closing the stream.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link sendQueueMessage}
   * @see {@link QueueUpstreamHandle}
   */
  createQueueUpstream(): QueueUpstreamHandle {
    this.#transport.ensureNotClosed('createQueueUpstream');

    let stream = this.#transport.duplexStream<
      kubemq.QueuesUpstreamRequest,
      kubemq.QueuesUpstreamResponse
    >('QueuesUpstream');
    let active = true;
    const pending = new Map<
      string,
      { resolve: (r: QueueUpstreamResult) => void; reject: (err: Error) => void }
    >();
    const clientId = this.clientId;
    const tracker = this.#transport.getSubscriptionTracker();
    const subId = randomUUID();

    const attachHandlers = () => {
      stream.onData((data: kubemq.QueuesUpstreamResponse) => {
        const p = pending.get(data.RefRequestID);
        if (p) {
          pending.delete(data.RefRequestID);
          const resp = fromProtoQueuesUpstreamResponse(data, 'createQueueUpstream');
          if (resp.isError) p.reject(new Error(resp.error ?? 'Queue upstream error'));
          else p.resolve(resp);
        }
      });
      stream.onError((err: Error) => {
        if (!active) return;
        for (const [, p] of pending) p.reject(err);
        pending.clear();
      });
      stream.onEnd(() => {
        if (!active) return;
        for (const [, p] of pending) p.reject(new Error('Queue upstream stream closed'));
        pending.clear();
      });
    };
    attachHandlers();

    tracker.register({
      id: subId,
      pattern: 'queue-stream',
      channel: '__upstream__',
      resubscribe: () => {
        if (!active) return;
        stream = this.#transport.duplexStream<
          kubemq.QueuesUpstreamRequest,
          kubemq.QueuesUpstreamResponse
        >('QueuesUpstream');
        attachHandlers();
      },
    });

    return {
      get isActive() {
        return active;
      },
      send(msgs: QueueMessage[]): Promise<QueueUpstreamResult> {
        if (!active) return Promise.reject(new Error('Queue upstream stream is closed'));
        const pbReq = toProtoQueuesUpstreamRequest(msgs, clientId);
        const reqId = pbReq.RequestID;
        return new Promise<QueueUpstreamResult>((resolve, reject) => {
          pending.set(reqId, { resolve, reject });
          stream.write(pbReq);
        });
      },
      close() {
        if (!active) return;
        active = false;
        tracker.unregister(subId);
        for (const [, p] of pending) p.reject(new Error('Queue upstream closed by client'));
        pending.clear();
        stream.end();
      },
    };
  }

  // ─── Consume Queue (GAP-23) ───

  /**
   * Consume queue messages as an async iterable of batches.
   *
   * @remarks
   * Wraps {@link streamQueueMessages} in a `for await...of`-friendly interface.
   * Each yielded {@link QueueBatch} must be settled via `ackAll()`, `nackAll()`,
   * or `reQueueAll()` before the next batch is fetched.
   *
   * @param opts - Stream options including channel and auto-ack behavior.
   * @yields Batches of messages with batch-level settlement methods.
   *
   * @see {@link streamQueueMessages}
   * @see {@link QueueBatch}
   * @see {@link QueueStreamOptions}
   */
  // M2 fix: removed dead while(true) + break outer loop
  async *consumeQueue(opts: QueueStreamOptions): AsyncIterable<QueueBatch> {
    const handle = this.streamQueueMessages(opts);
    try {
      let batchResolve: ((batch: QueueBatch | null) => void) | undefined;
      let batchReject: ((err: Error) => void) | undefined;
      let closed = false;

      handle.onMessages((messages) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const txnId = String((messages[0] as any)?._transactionId ?? '');
        const batch: QueueBatch = {
          messages,
          transactionId: txnId,
          ackAll: () => {
            handle.ackAll();
          },
          nackAll: () => {
            handle.nackAll();
          },
          reQueueAll: (ch: string) => {
            handle.reQueueAll(ch);
          },
        };
        if (batchResolve) {
          const r = batchResolve;
          batchResolve = undefined;
          batchReject = undefined;
          r(batch);
        }
      });

      handle.onError((err) => {
        closed = true;
        if (batchReject) {
          const rej = batchReject;
          batchResolve = undefined;
          batchReject = undefined;
          rej(err);
        }
      });

      handle.onClose(() => {
        closed = true;
        if (batchResolve) {
          const r = batchResolve;
          batchResolve = undefined;
          batchReject = undefined;
          r(null);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- closed is mutated by async callbacks
      while (!closed) {
        const batch = await new Promise<QueueBatch | null>((resolve, reject) => {
          batchResolve = resolve;
          batchReject = reject;
        });
        if (batch === null) break;
        yield batch;
      }
    } finally {
      handle.close();
    }
  }

  // ─── Event Stream Send (GAP-07) ───

  /**
   * Create a persistent event publishing stream for high-throughput fire-and-forget events.
   *
   * @remarks
   * Keeps a single gRPC bidirectional stream open. Errors are delivered
   * asynchronously via the `onError` handler on the returned handle.
   *
   * @returns An {@link EventStreamHandle} for sending events and closing the stream.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link sendEvent}
   * @see {@link EventStreamHandle}
   */
  createEventStream(): EventStreamHandle {
    this.#transport.ensureNotClosed('createEventStream');

    let stream = this.#transport.duplexStream<kubemq.Event, kubemq.Result>('SendEventsStream');
    let active = true;
    let streamReady = true; // JS-1v2: tracks whether the stream is usable
    let errHandler: ((err: Error) => void) | undefined;
    const clientId = this.clientId;
    const tracker = this.#transport.getSubscriptionTracker();
    const transport = this.#transport;
    const subId = randomUUID();

    // JS-1v2: drain all pending waiters and mark stream as broken
    const breakStream = () => {
      streamReady = false;
      const staleDrain = drainQueue.splice(0);
      for (const entry of staleDrain) {
        entry.reject(new Error('Event stream broken — will auto-reconnect'));
      }
      drainListenerAttached = false;
    };

    // JS-1v2: recreate the stream (used by both self-heal and resubscribe)
    const recreateStream = () => {
      try {
        stream.removeAllListeners();
      } catch { /* ignore */ }
      stream = transport.duplexStream<kubemq.Event, kubemq.Result>('SendEventsStream');
      drainListenerAttached = false;
      streamReady = true;
      attachHandlers();
    };

    // JS-1v2: self-healing — wait for transport READY then recreate stream
    let healingInProgress = false;
    const selfHeal = async () => {
      if (!active || healingInProgress) return;
      healingInProgress = true;
      try {
        // Wait for transport to be READY (poll with backoff)
        let delay = 500;
        const maxDelay = 5000;
        while (active && transport.state !== ConnectionState.READY) {
          await new Promise<void>((r) => setTimeout(r, delay));
          delay = Math.min(delay * 1.5, maxDelay);
        }
        if (!active) return;
        // If resubscribe() already fixed the stream while we were waiting, skip
        if (streamReady) return;
        // Small extra delay to let the new gRPC client stabilize
        await new Promise<void>((r) => setTimeout(r, 500));
        if (!active || streamReady) return;
        recreateStream();
      } catch {
        // If stream creation fails, wait and retry
        healingInProgress = false;
        if (active) {
          await new Promise<void>((r) => setTimeout(r, 1000));
          selfHeal();
        }
      } finally {
        healingInProgress = false;
      }
    };

    const attachHandlers = () => {
      stream.onData((result: kubemq.Result) => {
        if (!result.Sent && errHandler)
          errHandler(new Error(result.Error || 'Event stream send error'));
      });
      stream.onError((err: Error) => {
        if (!active) return;
        if (errHandler) errHandler(err);
        // JS-1v2: break the stream and self-heal
        breakStream();
        selfHeal();
      });
      stream.onEnd(() => {
        // JS-1v2: if the stream ends unexpectedly, treat it like an error
        if (!active || healingInProgress) return; // already healing or closed
        breakStream();
        selfHeal();
      });
    };
    attachHandlers();

    tracker.register({
      id: subId,
      pattern: 'events',
      channel: '__event-stream__',
      resubscribe: () => {
        if (!active) return;
        breakStream();
        recreateStream();
      },
    });

    const drainQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
    let drainListenerAttached = false;

    const ensureDrainListener = () => {
      if (drainListenerAttached) return;
      drainListenerAttached = true;
      stream.onDrain(() => {
        drainListenerAttached = false;
        const batch = drainQueue.splice(0);
        for (const entry of batch) entry.resolve();
      });
    };

    return {
      get isActive() {
        return active;
      },
      send(msg: EventMessage): Promise<void> {
        if (!active) return Promise.resolve();
        // JS-1v2: if stream is broken (reconnecting), reject so caller can retry
        if (!streamReady) return Promise.reject(new Error('Event stream reconnecting'));
        const ok = stream.write(toProtoEvent(msg, clientId, false));
        if (ok) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
          drainQueue.push({ resolve, reject });
          ensureDrainListener();
        });
      },
      onError(handler: (err: Error) => void) {
        errHandler = handler;
      },
      close() {
        if (!active) return;
        active = false;
        tracker.unregister(subId);
        stream.end();
      },
    };
  }

  /**
   * Create a persistent event-store publishing stream with delivery confirmation.
   *
   * @remarks
   * Unlike {@link createEventStream}, the `send()` method on the returned handle
   * returns a `Promise` that resolves when the server confirms persistence.
   *
   * @returns An {@link EventStoreStreamHandle} for sending events and closing the stream.
   * @throws {@link ClientClosedError} If the client has been closed.
   *
   * @see {@link sendEventStore}
   * @see {@link EventStoreStreamHandle}
   */
  createEventStoreStream(): EventStoreStreamHandle {
    this.#transport.ensureNotClosed('createEventStoreStream');

    let stream = this.#transport.duplexStream<kubemq.Event, kubemq.Result>('SendEventsStream');
    let active = true;
    let streamReady = true; // JS-1v2: tracks whether the stream is usable
    let errHandler: ((err: Error) => void) | undefined;
    const clientId = this.clientId;
    const tracker = this.#transport.getSubscriptionTracker();
    const transport = this.#transport;
    const subId = randomUUID();
    const pending = new Map<string, { resolve: () => void; reject: (err: Error) => void }>();

    // JS-1v2: reject all pending and mark stream as broken
    const breakStream = () => {
      streamReady = false;
      for (const [, p] of pending) {
        p.reject(new Error('Event store stream broken — will auto-reconnect'));
      }
      pending.clear();
    };

    // JS-1v2: recreate the stream (used by both self-heal and resubscribe)
    const recreateStream = () => {
      try {
        stream.removeAllListeners();
      } catch { /* ignore */ }
      stream = transport.duplexStream<kubemq.Event, kubemq.Result>('SendEventsStream');
      streamReady = true;
      attachHandlers();
    };

    // JS-1v2: self-healing — wait for transport READY then recreate stream
    let healingInProgress = false;
    const selfHeal = async () => {
      if (!active || healingInProgress) return;
      healingInProgress = true;
      try {
        // Wait for transport to be READY (poll with backoff)
        let delay = 500;
        const maxDelay = 5000;
        while (active && transport.state !== ConnectionState.READY) {
          await new Promise<void>((r) => setTimeout(r, delay));
          delay = Math.min(delay * 1.5, maxDelay);
        }
        if (!active) return;
        // If resubscribe() already fixed the stream while we were waiting, skip
        if (streamReady) return;
        // Small extra delay to let the new gRPC client stabilize
        await new Promise<void>((r) => setTimeout(r, 500));
        if (!active || streamReady) return;
        recreateStream();
      } catch {
        // If stream creation fails, wait and retry
        healingInProgress = false;
        if (active) {
          await new Promise<void>((r) => setTimeout(r, 1000));
          selfHeal();
        }
      } finally {
        healingInProgress = false;
      }
    };

    const attachHandlers = () => {
      stream.onData((result: kubemq.Result) => {
        const p = pending.get(result.EventID);
        if (p) {
          pending.delete(result.EventID);
          if (result.Sent) p.resolve();
          else p.reject(new Error(result.Error || 'Event store stream send failed'));
        }
      });
      stream.onError((err: Error) => {
        if (!active) return;
        if (errHandler) errHandler(err);
        // JS-1v2: break the stream and self-heal
        breakStream();
        selfHeal();
      });
      stream.onEnd(() => {
        // JS-1v2: if the stream ends unexpectedly, treat it like an error
        if (!active || healingInProgress) return; // already healing or closed
        breakStream();
        selfHeal();
      });
    };
    attachHandlers();

    tracker.register({
      id: subId,
      pattern: 'events-store',
      channel: '__event-store-stream__',
      resubscribe: () => {
        if (!active) return;
        breakStream();
        recreateStream();
      },
    });

    return {
      get isActive() {
        return active;
      },
      send(msg: EventStoreMessage): Promise<void> {
        if (!active) return Promise.reject(new Error('Event store stream is closed'));
        // JS-1v2: if stream is broken (reconnecting), reject so caller can retry
        if (!streamReady) return Promise.reject(new Error('Event store stream reconnecting'));
        const pbEvent = toProtoEvent(msg, clientId, true);
        const eventId = pbEvent.EventID;
        return new Promise<void>((resolve, reject) => {
          pending.set(eventId, { resolve, reject });
          stream.write(pbEvent);
        });
      },
      onError(handler: (err: Error) => void) {
        errHandler = handler;
      },
      close() {
        if (!active) return;
        active = false;
        tracker.unregister(subId);
        for (const [, p] of pending) p.reject(new Error('Event store stream closed by client'));
        pending.clear();
        stream.end();
      },
    };
  }

  // ─── AsyncDisposable ───

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  // ─── Internal ───

  #parseServerAddress(): { host: string; port: number } {
    const addr = this.address;
    const colonIdx = addr.lastIndexOf(':');
    if (colonIdx > 0) {
      const port = Number(addr.slice(colonIdx + 1));
      return { host: addr.slice(0, colonIdx), port: Number.isFinite(port) ? port : 50000 };
    }
    return { host: addr, port: 50000 };
  }

  #startSpan(
    operationName: OperationKind,
    channel: string,
    spanKind: number,
    extra?: Partial<Pick<SpanConfig, 'messageId' | 'consumerGroup' | 'bodySize' | 'batchCount'>>,
  ) {
    // Fast path: skip config object allocation when telemetry is disabled
    if (!this.#telemetry.isEnabled) return undefined;
    const { host, port } = this.#parseServerAddress();
    return this.#telemetry.startSpan({
      operationName,
      channel,
      spanKind: spanKind as SpanConfig['spanKind'],
      clientId: this.clientId,
      serverAddress: host,
      serverPort: port,
      ...extra,
    });
  }

  #retryHooks(operationName: string, channel?: string): RetryHooks {
    return {
      onRetry: () => {
        this.#metrics.recordRetryAttempt({ operationName, channel });
      },
      onExhausted: () => {
        this.#metrics.recordRetryExhausted({ operationName, channel });
      },
    };
  }

  #buildCallOptions(opts?: OperationOptions): TransportCallOptions {
    const callOpts: TransportCallOptions = {};
    if (opts?.timeout) {
      callOpts.deadline = new Date(Date.now() + opts.timeout);
    }
    if (opts?.signal) {
      callOpts.signal = opts.signal;
    }
    return callOpts;
  }

  #mapStreamError(err: Error, operation: string, channel?: string): KubeMQError {
    const rawErr = err as RawTransportError;
    if (typeof rawErr.code === 'number' && typeof rawErr.details === 'string') {
      return mapGrpcError(rawErr, { operation, channel, serverAddress: this.address });
    }
    return new KubeMQError({
      message: err.message,
      operation,
      channel,
      isRetryable: false,
      cause: err,
    });
  }
}
