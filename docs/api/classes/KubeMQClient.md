[**KubeMQ JS/TS SDK v3.0.0**](../README.md)

---

[KubeMQ JS/TS SDK](../README.md) / KubeMQClient

# Class: KubeMQClient

Defined in: client.ts:159

KubeMQ client for all messaging patterns.

## Remarks

**Async safety:** Safe for concurrent use from multiple async operations.
A single `KubeMQClient` instance should be shared across the application.
All methods are async and non-blocking. Concurrent calls to publish, send,
and subscribe methods are safe — the client serializes access to the
underlying gRPC channel internally.

## Implements

- `AsyncDisposable`

## Accessors

### options

#### Get Signature

> **get** **options**(): `Readonly`\<[`ClientOptions`](../interfaces/ClientOptions.md)\>

Defined in: client.ts:195

The raw user-provided options (frozen).

##### Returns

`Readonly`\<[`ClientOptions`](../interfaces/ClientOptions.md)\>

---

### clientId

#### Get Signature

> **get** **clientId**(): `string`

Defined in: client.ts:200

Auto-generated or user-provided client identifier.

##### Returns

`string`

---

### address

#### Get Signature

> **get** **address**(): `string`

Defined in: client.ts:205

The server address this client connects to.

##### Returns

`string`

---

### state

#### Get Signature

> **get** **state**(): `ConnectionState`

Defined in: client.ts:210

Current connection state.

##### Returns

`ConnectionState`

## Methods

### create()

> `static` **create**(`options`): `Promise`\<`KubeMQClient`\>

Defined in: client.ts:218

Async factory — validates config, applies defaults, creates
transport, and connects before returning a ready client.

#### Parameters

##### options

[`ClientOptions`](../interfaces/ClientOptions.md)

#### Returns

`Promise`\<`KubeMQClient`\>

---

### on()

> **on**\<`K`\>(`event`, `listener`): `this`

Defined in: client.ts:243

#### Type Parameters

##### K

`K` _extends_ `"connected"` \| `"disconnected"` \| `"reconnecting"` \| `"reconnected"` \| `"closed"` \| `"bufferDrain"` \| `"stateChange"`

#### Parameters

##### event

`K`

##### listener

[`ConnectionEventMap`](../type-aliases/ConnectionEventMap.md)\[`K`\]

#### Returns

`this`

---

### off()

> **off**\<`K`\>(`event`, `listener`): `this`

Defined in: client.ts:251

#### Type Parameters

##### K

`K` _extends_ `"connected"` \| `"disconnected"` \| `"reconnecting"` \| `"reconnected"` \| `"closed"` \| `"bufferDrain"` \| `"stateChange"`

#### Parameters

##### event

`K`

##### listener

[`ConnectionEventMap`](../type-aliases/ConnectionEventMap.md)\[`K`\]

#### Returns

`this`

---

### publishEvent()

> **publishEvent**(`msg`, `opts?`): `Promise`\<`void`\>

Defined in: client.ts:261

#### Parameters

##### msg

[`EventMessage`](../interfaces/EventMessage.md)

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<`void`\>

---

### publishEventStore()

> **publishEventStore**(`msg`, `opts?`): `Promise`\<`void`\>

Defined in: client.ts:297

#### Parameters

##### msg

[`EventStoreMessage`](../interfaces/EventStoreMessage.md)

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<`void`\>

---

### subscribeToEvents()

> **subscribeToEvents**(`sub`, `opts?`): [`Subscription`](../interfaces/Subscription.md)

Defined in: client.ts:333

#### Parameters

##### sub

[`EventsSubscription`](../interfaces/EventsSubscription.md)

##### opts?

[`SubscriptionOptions`](../interfaces/SubscriptionOptions.md)

#### Returns

[`Subscription`](../interfaces/Subscription.md)

---

### subscribeToEventsStore()

> **subscribeToEventsStore**(`sub`, `opts?`): [`Subscription`](../interfaces/Subscription.md)

Defined in: client.ts:405

#### Parameters

##### sub

[`EventStoreSubscription`](../interfaces/EventStoreSubscription.md)

##### opts?

[`SubscriptionOptions`](../interfaces/SubscriptionOptions.md)

#### Returns

[`Subscription`](../interfaces/Subscription.md)

---

### sendQueueMessage()

> **sendQueueMessage**(`msg`, `opts?`): `Promise`\<[`QueueSendResult`](../interfaces/QueueSendResult.md)\>

Defined in: client.ts:485

#### Parameters

##### msg

[`QueueMessage`](../interfaces/QueueMessage.md)

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<[`QueueSendResult`](../interfaces/QueueSendResult.md)\>

---

### sendQueueMessagesBatch()

> **sendQueueMessagesBatch**(`msgs`, `opts?`): `Promise`\<[`BatchSendResult`](../interfaces/BatchSendResult.md)\>

Defined in: client.ts:523

#### Parameters

##### msgs

[`QueueMessage`](../interfaces/QueueMessage.md)[]

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<[`BatchSendResult`](../interfaces/BatchSendResult.md)\>

---

### receiveQueueMessages()

> **receiveQueueMessages**(`req`, `opts?`): `Promise`\<[`ReceivedQueueMessage`](../interfaces/ReceivedQueueMessage.md)[]\>

Defined in: client.ts:574

#### Parameters

##### req

[`QueuePollRequest`](../interfaces/QueuePollRequest.md)

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<[`ReceivedQueueMessage`](../interfaces/ReceivedQueueMessage.md)[]\>

---

### streamQueueMessages()

> **streamQueueMessages**(`opts`): [`QueueStreamHandle`](../interfaces/QueueStreamHandle.md)

Defined in: client.ts:628

#### Parameters

##### opts

[`QueueStreamOptions`](../interfaces/QueueStreamOptions.md)

#### Returns

[`QueueStreamHandle`](../interfaces/QueueStreamHandle.md)

---

### peekQueueMessages()

> **peekQueueMessages**(`req`, `opts?`): `Promise`\<[`ReceivedQueueMessage`](../interfaces/ReceivedQueueMessage.md)[]\>

Defined in: client.ts:867

#### Parameters

##### req

[`QueuePollRequest`](../interfaces/QueuePollRequest.md)

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<[`ReceivedQueueMessage`](../interfaces/ReceivedQueueMessage.md)[]\>

---

### sendCommand()

> **sendCommand**(`msg`, `opts?`): `Promise`\<[`CommandResponse`](../interfaces/CommandResponse.md)\>

Defined in: client.ts:915

#### Parameters

##### msg

[`CommandMessage`](../interfaces/CommandMessage.md)

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<[`CommandResponse`](../interfaces/CommandResponse.md)\>

---

### sendQuery()

> **sendQuery**(`msg`, `opts?`): `Promise`\<[`QueryResponse`](../interfaces/QueryResponse.md)\>

Defined in: client.ts:952

#### Parameters

##### msg

[`QueryMessage`](../interfaces/QueryMessage.md)

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<[`QueryResponse`](../interfaces/QueryResponse.md)\>

---

### subscribeToCommands()

> **subscribeToCommands**(`sub`, `opts?`): [`Subscription`](../interfaces/Subscription.md)

Defined in: client.ts:989

#### Parameters

##### sub

[`CommandSubscription`](../interfaces/CommandSubscription.md)

##### opts?

[`SubscriptionOptions`](../interfaces/SubscriptionOptions.md)

#### Returns

[`Subscription`](../interfaces/Subscription.md)

---

### subscribeToQueries()

> **subscribeToQueries**(`sub`, `opts?`): [`Subscription`](../interfaces/Subscription.md)

Defined in: client.ts:1061

#### Parameters

##### sub

[`QuerySubscription`](../interfaces/QuerySubscription.md)

##### opts?

[`SubscriptionOptions`](../interfaces/SubscriptionOptions.md)

#### Returns

[`Subscription`](../interfaces/Subscription.md)

---

### sendCommandResponse()

> **sendCommandResponse**(`resp`, `opts?`): `Promise`\<`void`\>

Defined in: client.ts:1133

#### Parameters

##### resp

[`CommandResponse`](../interfaces/CommandResponse.md)

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<`void`\>

---

### sendQueryResponse()

> **sendQueryResponse**(`resp`, `opts?`): `Promise`\<`void`\>

Defined in: client.ts:1167

#### Parameters

##### resp

[`QueryResponse`](../interfaces/QueryResponse.md)

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<`void`\>

---

### createChannel()

> **createChannel**(`channelName`, `channelType`): `Promise`\<`void`\>

Defined in: client.ts:1203

#### Parameters

##### channelName

`string`

##### channelType

`ChannelType`

#### Returns

`Promise`\<`void`\>

---

### deleteChannel()

> **deleteChannel**(`channelName`, `channelType`): `Promise`\<`void`\>

Defined in: client.ts:1226

#### Parameters

##### channelName

`string`

##### channelType

`ChannelType`

#### Returns

`Promise`\<`void`\>

---

### listChannels()

> **listChannels**(`channelType`, `search?`): `Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

Defined in: client.ts:1248

#### Parameters

##### channelType

`ChannelType`

##### search?

`string`

#### Returns

`Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

---

### createEventsChannel()

> **createEventsChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1298

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### createEventsStoreChannel()

> **createEventsStoreChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1299

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### createCommandsChannel()

> **createCommandsChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1300

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### createQueriesChannel()

> **createQueriesChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1301

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### createQueuesChannel()

> **createQueuesChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1302

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteEventsChannel()

> **deleteEventsChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1304

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteEventsStoreChannel()

> **deleteEventsStoreChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1305

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteCommandsChannel()

> **deleteCommandsChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1306

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteQueriesChannel()

> **deleteQueriesChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1307

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteQueuesChannel()

> **deleteQueuesChannel**(`name`): `Promise`\<`void`\>

Defined in: client.ts:1308

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>

---

### listEventsChannels()

> **listEventsChannels**(`search?`): `Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

Defined in: client.ts:1310

#### Parameters

##### search?

`string`

#### Returns

`Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

---

### listEventsStoreChannels()

> **listEventsStoreChannels**(`search?`): `Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

Defined in: client.ts:1311

#### Parameters

##### search?

`string`

#### Returns

`Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

---

### listCommandsChannels()

> **listCommandsChannels**(`search?`): `Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

Defined in: client.ts:1312

#### Parameters

##### search?

`string`

#### Returns

`Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

---

### listQueriesChannels()

> **listQueriesChannels**(`search?`): `Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

Defined in: client.ts:1313

#### Parameters

##### search?

`string`

#### Returns

`Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

---

### listQueuesChannels()

> **listQueuesChannels**(`search?`): `Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

Defined in: client.ts:1314

#### Parameters

##### search?

`string`

#### Returns

`Promise`\<[`ChannelInfo`](../interfaces/ChannelInfo.md)[]\>

---

### close()

> **close**(`opts?`): `Promise`\<`void`\>

Defined in: client.ts:1318

#### Parameters

##### opts?

[`CloseOptions`](../interfaces/CloseOptions.md)

#### Returns

`Promise`\<`void`\>

---

### ping()

> **ping**(`opts?`): `Promise`\<[`ServerInfo`](../interfaces/ServerInfo.md)\>

Defined in: client.ts:1345

#### Parameters

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<[`ServerInfo`](../interfaces/ServerInfo.md)\>

---

### ackAllQueueMessages()

> **ackAllQueueMessages**(`channel`, `waitTimeSeconds?`, `opts?`): `Promise`\<`number`\>

Defined in: client.ts:1372

#### Parameters

##### channel

`string`

##### waitTimeSeconds?

`number` = `1`

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<`number`\>

---

### purgeQueue()

> **purgeQueue**(`channel`, `opts?`): `Promise`\<`void`\>

Defined in: client.ts:1422

#### Parameters

##### channel

`string`

##### opts?

[`OperationOptions`](../interfaces/OperationOptions.md)

#### Returns

`Promise`\<`void`\>

---

### createQueueUpstream()

> **createQueueUpstream**(): [`QueueUpstreamHandle`](../interfaces/QueueUpstreamHandle.md)

Defined in: client.ts:1428

#### Returns

[`QueueUpstreamHandle`](../interfaces/QueueUpstreamHandle.md)

---

### consumeQueue()

> **consumeQueue**(`opts`): `AsyncIterable`\<[`QueueBatch`](../interfaces/QueueBatch.md)\>

Defined in: client.ts:1515

#### Parameters

##### opts

[`QueueStreamOptions`](../interfaces/QueueStreamOptions.md)

#### Returns

`AsyncIterable`\<[`QueueBatch`](../interfaces/QueueBatch.md)\>

---

### createEventStream()

> **createEventStream**(): [`EventStreamHandle`](../interfaces/EventStreamHandle.md)

Defined in: client.ts:1577

#### Returns

[`EventStreamHandle`](../interfaces/EventStreamHandle.md)

---

### createEventStoreStream()

> **createEventStoreStream**(): [`EventStoreStreamHandle`](../interfaces/EventStoreStreamHandle.md)

Defined in: client.ts:1635

#### Returns

[`EventStoreStreamHandle`](../interfaces/EventStoreStreamHandle.md)

---

### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

Defined in: client.ts:1716

#### Returns

`Promise`\<`void`\>

#### Implementation of

`AsyncDisposable.[asyncDispose]`
