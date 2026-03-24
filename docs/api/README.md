**KubeMQ JS/TS SDK v3.0.0**

---

# KubeMQ JS/TS SDK v3.0.0

KubeMQ JavaScript/TypeScript SDK.

## Remarks

## Concurrency Model

This SDK is designed for Node.js single-threaded event loop environments.
Key guarantees:

- **Client:** `KubeMQClient` is safe for concurrent async operations.
  Share one instance per server connection.
- **Subscriptions:** Callbacks fire sequentially on the event loop by default.
  Opt-in concurrent processing is available via `maxConcurrentCallbacks`.
- **Messages:** Outbound messages are frozen after creation (immutable).
  Received messages are readonly. Do not modify either.
- **Cancellation:** All async operations support `AbortSignal` for
  cooperative cancellation.
- **Shutdown:** `close()` waits for in-flight callbacks before closing.

## Enumerations

- [EventStoreStartPosition](enumerations/EventStoreType.md)

## Classes

- [StaticTokenProvider](classes/StaticTokenProvider.md)
- [KubeMQClient](classes/KubeMQClient.md)
- [KubeMQError](classes/KubeMQError.md)
- [ConnectionError](classes/ConnectionError.md)
- [AuthenticationError](classes/AuthenticationError.md)
- [AuthorizationError](classes/AuthorizationError.md)
- [KubeMQTimeoutError](classes/KubeMQTimeoutError.md)
- [ValidationError](classes/ValidationError.md)
- [TransientError](classes/TransientError.md)
- [ThrottlingError](classes/ThrottlingError.md)
- [NotFoundError](classes/NotFoundError.md)
- [FatalError](classes/FatalError.md)
- [CancellationError](classes/CancellationError.md)
- [BufferFullError](classes/BufferFullError.md)
- [StreamBrokenError](classes/StreamBrokenError.md)
- [ClientClosedError](classes/ClientClosedError.md)
- [ConnectionNotReadyError](classes/ConnectionNotReadyError.md)
- [ConfigurationError](classes/ConfigurationError.md)
- [RetryExhaustedError](classes/RetryExhaustedError.md)
- [NotImplementedError](classes/NotImplementedError.md)
- [PartialFailureError](classes/PartialFailureError.md)
- [HandlerError](classes/HandlerError.md)

## Interfaces

- [CredentialProvider](interfaces/CredentialProvider.md)
- [ServerInfo](interfaces/ServerInfo.md)
- [KubeMQErrorOptions](interfaces/KubeMQErrorOptions.md)
- [StreamBrokenErrorOptions](interfaces/StreamBrokenErrorOptions.md)
- [RetryExhaustedErrorOptions](interfaces/RetryExhaustedErrorOptions.md)
- [PartialFailureErrorOptions](interfaces/PartialFailureErrorOptions.md)
- [ResolvedClientOptions](interfaces/ResolvedClientOptions.md)
- [ChannelStats](interfaces/ChannelStats.md)
- [ChannelInfo](interfaces/ChannelInfo.md)
- [Logger](interfaces/Logger.md)
- [CommandMessage](interfaces/CommandMessage.md)
- [CommandReceived](interfaces/ReceivedCommand.md)
- [CommandResponse](interfaces/CommandResponse.md)
- [CommandSubscription](interfaces/CommandSubscription.md)
- [EventStoreMessage](interfaces/EventStoreMessage.md)
- [EventStoreReceived](interfaces/ReceivedEventStore.md)
- [EventStoreSubscription](interfaces/EventStoreSubscription.md)
- [EventStoreStreamHandle](interfaces/EventStoreStreamHandle.md)
- [EventMessage](interfaces/EventMessage.md)
- [EventReceived](interfaces/ReceivedEvent.md)
- [EventsSubscription](interfaces/EventsSubscription.md)
- [EventStreamHandle](interfaces/EventStreamHandle.md)
- [QueryMessage](interfaces/QueryMessage.md)
- [QueryReceived](interfaces/ReceivedQuery.md)
- [QueryResponse](interfaces/QueryResponse.md)
- [QuerySubscription](interfaces/QuerySubscription.md)
- [QueueMessagePolicy](interfaces/QueueMessagePolicy.md)
- [QueueMessage](interfaces/QueueMessage.md)
- [ReceivedQueueMessage](interfaces/ReceivedQueueMessage.md)
- [QueuePollRequest](interfaces/QueuePollRequest.md)
- [QueueSendResult](interfaces/QueueSendResult.md)
- [BatchSendResult](interfaces/BatchSendResult.md)
- [BatchSendOptions](interfaces/BatchSendOptions.md)
- [QueueStreamOptions](interfaces/QueueStreamOptions.md)
- [QueueStreamMessage](interfaces/QueueStreamMessage.md)
- [QueueStreamHandle](interfaces/QueueStreamHandle.md)
- [QueueUpstreamResult](interfaces/QueueUpstreamResult.md)
- [QueueUpstreamHandle](interfaces/QueueUpstreamHandle.md)
- [QueueBatch](interfaces/QueueBatch.md)
- [Subscription](interfaces/Subscription.md)
- [RetryPolicy](interfaces/RetryPolicy.md)
- [ReconnectionPolicy](interfaces/ReconnectionPolicy.md)
- [TlsOptions](interfaces/TlsOptions.md)
- [KeepaliveOptions](interfaces/KeepaliveOptions.md)
- [OperationOptions](interfaces/OperationOptions.md)
- [SubscriptionOptions](interfaces/SubscriptionOptions.md)
- [CloseOptions](interfaces/CloseOptions.md)
- [ClientOptions](interfaces/ClientOptions.md)

## Type Aliases

- [ErrorCode](type-aliases/ErrorCode.md)
- [ErrorCategory](type-aliases/ErrorCategory.md)
- [ConnectionEventMap](type-aliases/ConnectionEventMap.md)
- [MessageBody](type-aliases/MessageBody.md)
- [LogContext](type-aliases/LogContext.md)
- [LogLevel](type-aliases/LogLevel.md)
- [JitterType](type-aliases/JitterType.md)

## Variables

- [ErrorCode](variables/ErrorCode.md)
- [ErrorCategory](variables/ErrorCategory.md)
- [noopLogger](variables/noopLogger.md)
- [DEFAULT_RETRY_POLICY](variables/DEFAULT_RETRY_POLICY.md)
- [DEFAULT_KEEPALIVE](variables/DEFAULT_KEEPALIVE.md)
- [DEFAULT_RECONNECTION_POLICY](variables/DEFAULT_RECONNECTION_POLICY.md)
- [DEFAULT_CONNECTION_TIMEOUT_MS](variables/DEFAULT_CONNECTION_TIMEOUT_MS.md)
- [DEFAULT_MAX_MESSAGE_SIZE](variables/DEFAULT_MAX_MESSAGE_SIZE.md)
- [DEFAULT_RECONNECT_BUFFER_SIZE](variables/DEFAULT_RECONNECT_BUFFER_SIZE.md)
- [DEFAULT_SEND_TIMEOUT_MS](variables/DEFAULT_SEND_TIMEOUT_MS.md)
- [DEFAULT_SUBSCRIBE_TIMEOUT_MS](variables/DEFAULT_SUBSCRIBE_TIMEOUT_MS.md)
- [DEFAULT_RPC_TIMEOUT_MS](variables/DEFAULT_RPC_TIMEOUT_MS.md)
- [DEFAULT_QUEUE_RECEIVE_TIMEOUT_MS](variables/DEFAULT_QUEUE_RECEIVE_TIMEOUT_MS.md)
- [DEFAULT_QUEUE_POLL_TIMEOUT_MS](variables/DEFAULT_QUEUE_POLL_TIMEOUT_MS.md)
- [DEFAULT_MAX_CONCURRENT_RETRIES](variables/DEFAULT_MAX_CONCURRENT_RETRIES.md)
- [SDK_VERSION](variables/SDK_VERSION.md)

## Functions

- [normalizeBody](functions/normalizeBody.md)
- [bodyToString](functions/bodyToString.md)
- [stringToBytes](functions/stringToBytes.md)
- [bytesToString](functions/bytesToString.md)
- [toBytes](functions/toBytes.md)
- [toBuffer](functions/toBuffer.md)
- [generateId](functions/generateId.md)
- [validateMessageSize](functions/validateMessageSize.md)
- [createConsoleLogger](functions/createConsoleLogger.md)
- [createCommand](functions/createCommand.md)
- [createEventStoreMessage](functions/createEventStoreMessage.md)
- [createEventMessage](functions/createEventMessage.md)
- [createQuery](functions/createQuery.md)
- [createQueueMessage](functions/createQueueMessage.md)
