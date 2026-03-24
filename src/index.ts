/**
 * KubeMQ JavaScript/TypeScript SDK.
 *
 * @remarks
 * ## Concurrency Model
 *
 * This SDK is designed for Node.js single-threaded event loop environments.
 * Key guarantees:
 *
 * - **Client:** `KubeMQClient` is safe for concurrent async operations.
 *   Share one instance per server connection.
 * - **Subscriptions:** Callbacks fire sequentially on the event loop by default.
 *   Opt-in concurrent processing is available via `maxConcurrentCallbacks`.
 * - **Messages:** Outbound messages are frozen after creation (immutable).
 *   Received messages are readonly. Do not modify either.
 * - **Cancellation:** All async operations support `AbortSignal` for
 *   cooperative cancellation.
 * - **Shutdown:** `close()` waits for in-flight callbacks before closing.
 *
 * @packageDocumentation
 */

// Errors (owned by GS-01)
export {
  KubeMQError,
  ConnectionError,
  AuthenticationError,
  AuthorizationError,
  KubeMQTimeoutError,
  ValidationError,
  TransientError,
  ThrottlingError,
  NotFoundError,
  FatalError,
  CancellationError,
  BufferFullError,
  StreamBrokenError,
  ClientClosedError,
  ConnectionNotReadyError,
  ConfigurationError,
  RetryExhaustedError,
  NotImplementedError,
  PartialFailureError,
  HandlerError,
  ErrorCode,
  ErrorCategory,
} from './errors.js';
export type {
  KubeMQErrorOptions,
  StreamBrokenErrorOptions,
  RetryExhaustedErrorOptions,
  PartialFailureErrorOptions,
} from './errors.js';

// Client
export { KubeMQClient } from './client.js';
export type { ServerInfo, ChannelType, ChannelInfo, ChannelStats } from './client.js';

// Configuration (owned by GS-02 for types, GS-07 for placement)
export type {
  JitterType,
  ClientOptions,
  RetryPolicy,
  ReconnectionPolicy,
  TlsOptions,
  KeepaliveOptions,
  OperationOptions,
  SubscriptionOptions,
  CloseOptions,
} from './options.js';
export {
  DEFAULT_RETRY_POLICY,
  DEFAULT_KEEPALIVE,
  DEFAULT_RECONNECTION_POLICY,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_MAX_MESSAGE_SIZE,
  DEFAULT_RECONNECT_BUFFER_SIZE,
  DEFAULT_SEND_TIMEOUT_MS,
  DEFAULT_SUBSCRIBE_TIMEOUT_MS,
  DEFAULT_RPC_TIMEOUT_MS,
  DEFAULT_QUEUE_RECEIVE_TIMEOUT_MS,
  DEFAULT_QUEUE_POLL_TIMEOUT_MS,
  DEFAULT_MAX_CONCURRENT_RETRIES,
} from './options.js';

// Resolved options (owned by GS-09 — internal but exported for advanced use)
export type { ResolvedClientOptions } from './internal/config-defaults.js';

// Connection Event Map (typed event names for client.on / client.off)
export type { ConnectionEventMap } from './internal/transport/typed-emitter.js';

// Logger (owned by GS-05)
export { noopLogger, createConsoleLogger } from './logger.js';
export type { Logger, LogLevel, LogContext } from './logger.js';

// Auth (owned by GS-03)
export type { CredentialProvider } from './auth/credential-provider.js';
export { StaticTokenProvider } from './auth/credential-provider.js';

// Connection State (from internal — exported because users need it)
export { ConnectionState } from './internal/transport/connection-state.js';

// Body utilities (owned by GS-09)
export type { MessageBody } from './internal/utils/body.js';
export { normalizeBody, bodyToString } from './internal/utils/body.js';

// Encoding utilities (owned by GS-13 — REQ-PERF-3)
export { stringToBytes, bytesToString, toBytes, toBuffer } from './internal/utils/encoding.js';

// ID generation (owned by GS-13 — REQ-PERF-1)
export { generateId } from './internal/utils/id.js';

// Message size validation (owned by GS-13 — REQ-PERF-4)
export { validateMessageSize } from './internal/validation/message-size.js';

// Messages — Events (owned by GS-09)
export type {
  EventMessage,
  EventReceived,
  EventsSubscription,
  EventStreamHandle,
} from './messages/events.js';
export { createEventMessage } from './messages/events.js';

// Messages — Events Store (owned by GS-09)
export { EventStoreStartPosition, createEventStoreMessage } from './messages/events-store.js';
export type {
  EventStoreMessage,
  EventStoreReceived,
  EventStoreResult,
  EventStoreSubscription,
  EventStoreStreamHandle,
} from './messages/events-store.js';

// Messages — Queues (owned by GS-09)
export type {
  QueueMessage,
  ReceivedQueueMessage,
  QueueMessagePolicy,
  QueuePollRequest,
  QueueSendResult,
  BatchSendResult,
  BatchSendOptions,
  QueueStreamOptions,
  QueueStreamMessage,
  QueueStreamHandle,
  QueueUpstreamHandle,
  QueueUpstreamResult,
  QueueBatch,
} from './messages/queues.js';
export { createQueueMessage } from './messages/queues.js';

// Messages — Commands (owned by GS-09)
export type {
  CommandMessage,
  CommandReceived,
  CommandResponse,
  CommandSubscription,
} from './messages/commands.js';
export { createCommand } from './messages/commands.js';

// Messages — Queries (owned by GS-09)
export type {
  QueryMessage,
  QueryReceived,
  QueryResponse,
  QuerySubscription,
} from './messages/queries.js';
export { createQuery } from './messages/queries.js';

// Subscription Handle (owned by GS-09)
export type { Subscription } from './messages/subscription.js';

// Version (owned by GS-11)
export { SDK_VERSION } from './version.js';
