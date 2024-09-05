# KubeMQ Node JS/TS SDK

  

The **KubeMQ SDK for NodeJS/TS** enables typescript developers to communicate with [KubeMQ](https://kubemq.io/) server.

  

## Prerequisites

  

- Node.js (Ensure you have a recent version of Node.js installed)

- TypeScript Compiler

- KubeMQ server running locally or accessible over the network

  

## Install KubeMQ Community Edition

Please visit [KubeMQ Community](https://github.com/kubemq-io/kubemq-community) for intallation steps.

  

## General SDK description

The SDK implements all communication patterns available through the KubeMQ server:

- Events

- EventStore

- Command

- Query

- Queue

  

### Installing

  

The recommended way to use the SDK for Node in your project is to consume it from Node package manager.

```

npm install kubemq-js

```

## Running the examples

  

The [examples](https://github.com/kubemq-io/kubemq-js/tree/main/examples)

are standalone projects that showcase the usage of the SDK.

  

To run the examples, you need to have a running instance of KubeMQ.

Import the project in any IDE of choice like Visual Studio Code or IntelliJ .

You will see three directory in example project which contains files to showing

implementation.

Directories are:

`cq`

`pubsub`

`queues`

**cq** directory contains the example related to Command and Query

**pubsub** directory contains the example related to Event and EventStore

**queues** directory contains the example related to Queues

  
  

## Building from source

  

Once you check out the code from GitHub, you can build it using Node & Typescript.

  

``` bash

npx tsc path/to/example_file.ts

Example:

npx  tsc  examples/cq/commnds/create.ts

```

Above command will compile the .ts file and produce the .js file in same directory where .ts file is, If you use the `npm run build` it will generate the js files
in dist folder `dist/examples` 

To run the compiled JavaScript file use below command .

```bash

node  path/to/example_file.js

Example:

node  examples/cq/commnds/create.js

```

## Payload Details

  

-  **Metadata:** The metadata allows us to pass additional information with the event. Can be in any form that can be presented as a string, i.e., struct, JSON, XML and many more.

-  **Body:** The actual content of the event. Can be in any form that is serializable into a byte array, i.e., string, struct, JSON, XML, Collection, binary file and many more.

-  **ClientID:** Displayed in logs, tracing, and KubeMQ dashboard(When using Events Store, it must be unique).

-  **Tags:** Set of Key value pair that help categorize the message

  

# KubeMQ PubSub Client Examples

Below examples demonstrating the usage of KubeMQ PubSub (Event and EventStore) client. The examples include creating, deleting, listing channels, and sending/subscribing event messages.

  

## File Structure

  

#### Event

-  `pubsub\events\create.ts`: Demonstrates creating event channels.

-  `pubsub\events\delete.ts`: Demonstrates deleting event channels.

-  `pubsub\events\list.ts`: Demonstrates listing event channels.

-  `pubsub\events\send-message-multicast-mix.ts`: Demonstrates subscribing to event, eventStore & queues channel and sending message to these channel.

-  `pubsub\events\send-message.ts`: Demonstrates to send a single message to single channel & multiple event channel

-  `pubsub\events\subscribe-event.ts`: Demonstrates Subscribe to single channel

-  `pubsub\events\wildcard.ts` Demonstrates example of subscribing the channel using wildcard characters and sending message .

  

#### EventStore

-  `pubsub\events\create.ts`: Demonstrates creating event store channels.

-  `pubsub\events\delete.ts`: Demonstrates deleting event store channels.

-  `pubsub\events\list.ts`: Demonstrates listing event store channels.

-  `pubsub\events\send-message-multicast-mix.ts`: Demonstrates subscribing to event, eventStore & queues channel and sending message to these channel.

-  `pubsub\events\send-message.ts`: Demonstrates to send a single message to multiple event channel

-  `pubsub\events\subscribe-eventstore.ts`: Demonstrates Subscribe to single channel

-  `pubsub\events\subscribe-eventstore-offset.ts` Demonstrates example of subscribing the channel and receiving message using the specified offset.

  

## Getting Started

  

### Construct the PubsubClient

For executing PubSub operation we have to create the instance of PubsubClient, it's instance can created with minimum two parameter `address` (KubeMQ server address) & `clientId` . With these two parameter plainText connection are established. Below Table Describe the Parameters available for establishing connection.

### PubsubClient Accepted Configuration

  

| Name | Type | Description | Default Value | Mandatory |

|--------------------------|----------|---------------------------------------------------------------|-------------------------|-----------|

| address | String | The address of the KubeMQ server. | None | Yes |

| clientId | String | The client ID used for authentication. | None | Yes |

| authToken | String | The authorization token for secure communication. | None | No |

| tls | boolean | Indicates if TLS (Transport Layer Security) is enabled. | None | No |

| tlsCertFile | String | The path to the TLS certificate file. | None | No (Yes if `tls` is true) |

| tlsKeyFile | String | The path to the TLS key file. | None | No (Yes if `tls` is true) |

| maxReceiveSize | int | The maximum size of the messages to receive (in bytes). | 104857600 (100MB) | No |

| reconnectIntervalSeconds | int | The interval in seconds between reconnection attempts. | 5 | No |

| keepAlive | boolean | Indicates if the connection should be kept alive. | None | No |

| pingIntervalInSeconds | int | The interval in seconds between ping messages. | None | No |

| pingTimeoutInSeconds | int | The timeout in seconds for ping messages. | None | No |

| logLevel | Level | The logging level to use. | Level. INFO | No |

  

### PubsubClient connection establishment example code

  

```typescript

const  opts: Config = {

address:  'localhost:50000',

clientId:  Utils.uuid(),

reconnectInterval:  1000,

};

  

const  pubsubClient = new  PubsubClient(opts);

```

Below example demonstrate to construct PubSubClient with ssl and other configurations:

```typescript

const  config: Config = {

address:  'localhost:50000', // KubeMQ gRPC endpoint address

clientId:  'your-client-id', // Connection clientId

authToken:  'your-jwt-auth-token', // Optional JWT authorization token

tls:  true, // Indicates if TLS is enabled

tlsCertFile:  'path/to/tls-cert.pem', // Path to the TLS certificate file

tlsKeyFile:  'path/to/tls-key.pem', // Path to the TLS key file

maxReceiveSize:  1024 * 1024 * 100, // Maximum size of the messages to receive (100MB)

reconnectInterval:  1000, // Interval in milliseconds between reconnect attempts (1 second)

keepAlive:  true, // Indicates if the connection should be kept alive

pingIntervalInSeconds:  60, // Interval in seconds between ping messages

pingTimeoutInSeconds:  30, // Timeout in seconds for ping messages

logLevel:  'INFO', // Logging level for the client

credentials: {

cert:  Buffer.from('your-cert-content'), // Optional client cert credentials for talking to KubeMQ

key:  Buffer.from('your-key-content'),

caCert:  Buffer.from('your-ca-cert-content') // Optional CA certificate

}

}

```

  

**Ping To KubeMQ server**

You can ping the server to check connection is established or not.

#### Request: `NONE`

  
  

#### Response: `ServerInfo` Interface Attributes

  

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| host | String | The host of the server. |

| version | String | The version of the server. |

| serverStartTime | long | The start time of the server (in seconds). |

| serverUpTimeSeconds | long | The uptime of the server (in seconds). |

  

```typescript

ServerInfo  pingResult = pubsubClient.ping();

console.log('Ping Response: ' + pingResult);

  

```

**PubSub CreateEventsChannel Example:**

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to subscribe | None | Yes |

  
  

#### Response:

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| void | Promise<void>| Doesn't return value upon completion|

  

```typescript

async  function  create(channel: string) {

return  pubsubClient.createEventsChannel(channel);

}

```

**PubSub Create Events Store Channel Example:**

  

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to subscribe | None | Yes |

  
  

#### Response:

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| void | Promise<void>| Doesn't return value upon completion|

----------------------------------------------------------------------------

```typescript

async  function  create(channel: string) {

return  pubsubClient.createEventsStoreChannel(channel);

}

```

**PubSub ListEventsChannel Example:**

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to search | None | No |

  
  

#### Response: `PubSubChannel[]`  `PubSubChannel` interface Attributes

  

| Name | Type | Description |

|--------------|-------------|-----------------------------------------------------------------------------------------------|

| name | String | The name of the Pub/Sub channel. |

| type | String | The type of the Pub/Sub channel. |

| lastActivity | long | The timestamp of the last activity on the channel, represented in milliseconds since epoch. |

| isActive | boolean | Indicates whether the channel is active or not. |

| incoming | PubSubStats | The statistics related to incoming messages for this channel. |

| outgoing | PubSubStats | The statistics related to outgoing messages for this channel. |

  
  

```typescript

async  function  list(search: string) {

const  channels = await  pubsubClient.listEventsChannels(search);

console.log(channels);

}

```

**PubSub ListEventsStoreChannel Example:**

  

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to search | None | No |

  
  

#### Response: `PubSubChannel[]`  `PubSubChannel` interface Attributes

  

| Name | Type | Description |

|--------------|-------------|-----------------------------------------------------------------------------------------------|

| name | String | The name of the Pub/Sub channel. |

| type | String | The type of the Pub/Sub channel. |

| lastActivity | long | The timestamp of the last activity on the channel, represented in milliseconds since epoch. |

| isActive | boolean | Indicates whether the channel is active or not. |

| incoming | PubSubStats | The statistics related to incoming messages for this channel. |

| outgoing | PubSubStats | The statistics related to outgoing messages for this channel.

```typescript

async  function  list(search: string) {

const  channels = await  pubsubClient.listEventsStoreChannels(search);

console.log(channels);

}

```

**PubSub SendEventMessage Example:**

#### Request: `EventMessage` Interface Attributes

  

| Name | Type | Description | Default Value | Mandatory |

|-----------|--------------------|-------------------------------------------------------------------------------------|-----------------|-----------|

| id | String | Unique identifier for the event message. | None | No |

| channel | String | The channel to which the event message is sent. | None | Yes |

| metadata | String | Metadata associated with the event message. | None | No |

| body | byte[] | Body of the event message in bytes. | Empty byte array | No |

| tags | Map<String, String>| Tags associated with the event message as key-value pairs. | Empty Map | No |

**Note:-**  `metadata` or `body` or `tags` any one is required

  

#### Response: `NONE`

  

```typescript

await  pubsubClient.sendEventsMessage({

id:  `234`

channel: 'events.single',

body:  Utils.stringToBytes('event message'),

});

```

**PubSub SendEventStoreMessage Example:**

  

#### Request: `EventStoreMessage` Class Attributes

  

| Name | Type | Description | Default Value | Mandatory |

|-----------|--------------------|-------------------------------------------------------------------------------------|-----------------|-----------|

| id | String | Unique identifier for the event message. | None | No |

| channel | String | The channel to which the event message is sent. | None | Yes |

| metadata | String | Metadata associated with the event message. | None | No |

| body | byte[] | Body of the event message in bytes. | Empty byte array | No |

| tags | Map<String, String>| Tags associated with the event message as key-value pairs. | Empty Map | No |

**Note:-**  `metadata` or `body` or `tags` any one is required

  

#### Response: `NONE`

```typescript

await  pubsubClient.sendEventStoreMessage({

id:  '987'

channel: 'events_store.single',

body:  Utils.stringToBytes('event store message'),

});

```

**PubSub SubscribeEvents Example:**

#### Request: `EventsSubscription` Class Attributes

  

| Name | Type | Description | Default Value | Mandatory |

|-------------------------|---------------------------|----------------------------------------------------------------------|---------------|-----------|

| channel | String | The channel to subscribe to. | None | Yes |

| group | String | The group to subscribe with. | None | No |

| onReceiveEventCallback | Consumer<EventMessageReceived> | Callback function to be called when an event message is received. | None | Yes |

| onErrorCallback | Consumer<String> | Callback function to be called when an error occurs. | None | No |

  
  

#### Response: `NONE`

#### Callback: `EventMessageReceived` class details

| Name | Type | Description |

|-------------|-----------------------|--------------------------------------------------------|

| id | String | The unique identifier of the message. |

| fromClientId| String | The ID of the client that sent the message. |

| timestamp | long | The timestamp when the message was received, in seconds. |

| channel | String | The channel to which the message belongs. |

| metadata | String | The metadata associated with the message. |

| body | byte[] | The body of the message. |

| sequence | long | The sequence number of the message. |

| tags | Map<String, String> | The tags associated with the message. |

  

```typescript

await  pubsubClient
.subscribeToEvents(
{
channel:  'events.A',
clientId:  'SubscriberA',
},
(err, msg) => {
if (err) {
console.error('SubscriberA', err);
return;
}

if (msg) {
console.log('SubscriberA', msg);
}
},
).catch((reason) => {
console.log(reason);
});

```

**PubSub SubscribeEventsStore Example:**

#### Request: `EventsStoreSubscription` Interface Attributes

  

| Name | Type | Description | Default Value | Mandatory |

|-------------------------|---------------------------|----------------------------------------------------------------------|---------------|-----------|

| channel | String | The channel to subscribe to. | None | Yes |

| group | String | The group to subscribe with. | None | No |

| onReceiveEventCallback | Consumer<EventStoreMessageReceived> | Callback function to be called when an event message is received. | None | Yes |

| onErrorCallback | Consumer<String> | Callback function to be called when an error occurs.

  
  

#### Response: `None`

#### Callback: `EventStoreMessageReceived` class details

| Name | Type | Description |

|-------------|-----------------------|--------------------------------------------------------|

| id | String | The unique identifier of the message. |

| fromClientId| String | The ID of the client that sent the message. |

| timestamp | long | The timestamp when the message was received, in seconds. |

| channel | String | The channel to which the message belongs. |

| metadata | String | The metadata associated with the message. |

| body | byte[] | The body of the message. |

| sequence | long | The sequence number of the message. |

| tags | Map<String, String> | The tags associated with the message. |

  

```typescript

await  pubsubClient
.subscribeToEventsStore(
{
channel:  'events_store.A',
group:  'g1',
clientId:  'SubscriberA',
requestType:  EventStoreType.StartFromFirst,
},
(err, msg) => {
if (err) {
console.error('SubscriberA', err);
return;
}

if (msg) {
console.log('SubscriberA', msg);
}
},
)
.catch((reason) => {
   console.log(reason);
});

```

**PubSub DeleteEventsChannel Example:**

  

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to delete | None | Yes |

  
  

#### Response:

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| void | Promise<void>| Return nothing|

----------------------------------------------------------------------------

```typescript

async  function  deleteChannel(channel: string) {

return  pubsubClient.deleteEventsChannel(channel);

}

  

```

**PubSub DeleteEventsStoreChannel Example:**

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to delete | None | Yes |

  
  

#### Response:

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| isChannelDeleted | boolean| Channel deleted true/false|

----------------------------------------------------------------------------

  

```typescript

async  function  deleteChannel(channel: string) {

return  pubsubClient.deleteEventsStoreChannel(channel);

}

```

  

# KubeMQ Queues Client Examples

Below examples demonstrating the usage of KubeMQ Queues client. The examples include creating, deleting, listing channels, and sending/receiving queues messages.

  

## Project Structure

  

-  `queues/create.ts`: Demonstrates creating queues channels.

-  `queues/delete.ts`: Demonstrates deleting queues channels.

-  `queues/list.ts`: Demonstrates listing queues channels.

-  `queues/dead-letter.ts`: Demonstrates sending message which will pushed to dead-letter-queue and then pulling back.

-  `queues/send-message-multicast-mis.ts`: Demonstrates sending message in various types of channels.

-  `queues/send-message.ts`: Demonstrates example of sending message.

-  `queues/subscribe-queue.ts`: Demonstrates example of subscribing queue.

-  `queues/wait-pull.ts`: Demonstrates example of pulling message by waiting and pulling.

  

## Getting Started

  

### Construct the QueuesClient

For executing Queues operation we have to create the instance of QueuesClient, it's instance can created with minimum two parameter `address` (KubeMQ server address) & `clientId` . With these two parameter plainText connection are established. Below Table Describe the Parameters available for establishing connection.

### QueuesClient Accepted Configuration

  

| Name | Type | Description | Default Value | Mandatory |

|--------------------------|----------|---------------------------------------------------------------|-------------------------|-----------|

| address | String | The address of the KubeMQ server. | None | Yes |

| clientId | String | The client ID used for authentication. | None | Yes |

| authToken | String | The authorization token for secure communication. | None | No |

| tls | boolean | Indicates if TLS (Transport Layer Security) is enabled. | None | No |

| tlsCertFile | String | The path to the TLS certificate file. | None | No (Yes if `tls` is true) |

| tlsKeyFile | String | The path to the TLS key file. | None | No (Yes if `tls` is true) |

| maxReceiveSize | int | The maximum size of the messages to receive (in bytes). | 104857600 (100MB) | No |

| reconnectIntervalSeconds | int | The interval in seconds between reconnection attempts. | 5 | No |

| keepAlive | boolean | Indicates if the connection should be kept alive. | None | No |

| pingIntervalInSeconds | int | The interval in seconds between ping messages. | None | No |

| pingTimeoutInSeconds | int | The timeout in seconds for ping messages. | None | No |

| logLevel | Level | The logging level to use. | Level. INFO | No |

  

### QueuesClient establishing connection example code

```typescript

const  opts: Config = {
	address:  'localhost:50000',
	clientId:  Utils.uuid(),
};

const  queuesClient = new  QueuesClient(opts);

```

Below example demonstrate to construct PubSubClient with ssl and other configurations:

```typescript

const  config: Config = {
	address:  'localhost:50000', // KubeMQ gRPC endpoint address
	clientId:  'your-client-id', // Connection clientId
	authToken:  'your-jwt-auth-token', // Optional JWT authorization token
	tls:  true, // Indicates if TLS is enabled
	tlsCertFile:  'path/to/tls-cert.pem', // Path to the TLS certificate file
	tlsKeyFile:  'path/to/tls-key.pem', // Path to the TLS key file
	maxReceiveSize:  1024 * 1024 * 100, // Maximum size of the messages to receive (100MB)
	reconnectInterval:  1000, // Interval in milliseconds between reconnect attempts (1 second)
	keepAlive:  true, // Indicates if the connection should be kept alive
	pingIntervalInSeconds:  60, // Interval in seconds between ping messages
	pingTimeoutInSeconds:  30, // Timeout in seconds for ping messages
	logLevel:  'INFO', // Logging level for the client
	credentials: {
	cert:  Buffer.from('your-cert-content'), // Optional client cert credentials for talking to KubeMQ
	key:  Buffer.from('your-key-content'),
	caCert:  Buffer.from('your-ca-cert-content') // Optional CA certificate
}

const  queuesClient = new  QueuesClient(opts);

```

  

**Ping To KubeMQ server**

You can ping the server to check connection is established or not.

#### Request: `NONE`

  

#### Response: `ServerInfo` Class Attributes

  

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| host | String | The host of the server. |

| version | String | The version of the server. |

| serverStartTime | long | The start time of the server (in seconds). |

| serverUpTimeSeconds | long | The uptime of the server (in seconds). |

  

```typescript

ServerInfo  pingResult = queuesClient.ping();
console.log('Ping Response: ' + pingResult);

```

**Queues CreateQueueChannel Example:**

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to create | None | Yes |

  
  

#### Response:

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| isChannelCreated | boolean| Channel created true/false|

----------------------------------------------------------------------------

```typescript

async  function  create(channel: string) {
	return  queuesClient.createQueuesChannel(channel);
}

```

**Queues listQueueChannels Example:**

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| searchString | String | Channel name which you want to search | None | No |

  
  

#### Response: `QueuesChannel[]` QueuesChannel interface Attributes

  

| Name | Type | Description |

|---------------|---------------|------------------------------------------------------------|

| name | String | The name of the queue channel. |

| type | String | The type of the queue channel. |

| lastActivity | long | The timestamp of the last activity in the queue channel. |

| isActive | boolean | Indicates whether the queue channel is currently active. |

| incoming | QueuesStats | The statistics for incoming messages in the queue channel. |

| outgoing | QueuesStats | The statistics for outgoing messages in the queue channel. |

  
  

```typescript

async  function  list(search: string) {
	const  channels = await  queuesClient.listQueuesChannel(search);
	console.log(channels);
}

```

  

**Queues SendSingleMessage Example:**

#### Request: `QueueMessage` class attributes

| Name | Type | Description | Default Value | Mandatory |

|------------------------------|---------------------|---------------------------------------------------------------------------------------------|---------------|-----------|

| id | String | The unique identifier for the message. | None | No |

| channel | String | The channel of the message. | None | Yes |

| metadata | String | The metadata associated with the message. | None | No |

| body | byte[] | The body of the message. | new byte[0] | No |

| tags | Map<String, String> | The tags associated with the message. | new HashMap<>()| No |

| delayInSeconds | int | The delay in seconds before the message becomes available in the queue. | None | No |

| expirationInSeconds | int | The expiration time in seconds for the message. | None | No |

| attemptsBeforeDeadLetterQueue| int | The number of receive attempts allowed for the message before it is moved to the dead letter queue. | None | No |

| deadLetterQueue | String | The dead letter queue where the message will be moved after reaching the maximum receive attempts. | None | No |

  
  

#### Response: `QueueSendResult` class attributes

| Name | Type | Description |

|------------|-----------------|---------------------------------------------------------------|

| id | String | The unique identifier of the message. |

| sentAt | LocalDateTime | The timestamp when the message was sent. |

| expiredAt | LocalDateTime | The timestamp when the message will expire. |

| delayedTo | LocalDateTime | The timestamp when the message will be delivered. |

| isError | boolean | Indicates if there was an error while sending the message. |

| error | String | The error message if `isError` is true. |

  

```typescript

await  queuesClient
.sendQueuesMessage({
	channel:  'queues.single',
	body:  Utils.stringToBytes('queue message'),
})
.then((result) =>  console.log(result))
.catch((reason) =>  console.error(reason));
```

  

**Queues Pulls messages from a queue. Example:**

#### Request: `QueuesPullWaitngMessagesRequest` class attributes

| Name | Type | Description | Default Value | Mandatory |

|-----------------------------|--------|------------------------------------------------------|---------------|-----------|

| channel | String | The channel to poll messages from. | None | Yes |

| maxNumberOfMessages | int | The maximum number of messages to poll. | 1 | No |

| waitTimeoutSeconds | int | The wait timeout in seconds for polling messages. | 60 | No |

  
  

#### Response: `QueuesPullWaitingMessagesResponse` class attributes

| Name | Type | Description |

|-----------------------|-----------------------------------|---------------------------------------------------------|

| id | String | The reference ID of the request. |

| messagesReceived | number | number of valid messages received. |

| messages | `QueueMessage[]` | The list of received queue messages. |

| error | String | The error message, if any error occurred. |

| isError | boolean | Indicates if there was an error. |

| isPeek. | boolean | Indicates is peak or pul. |

| messagesExpired | number | number of expired messages from the queue |

  

```typescript

await  queuesClient
.pull({
	channel:  'queues.peek',
	maxNumberOfMessages:  10,
	waitTimeoutSeconds:  10,
})

.then((response) => {
	response.messages.forEach((msg) => {
	console.log(msg);
});
})

.catch((reason) => {
	console.error(reason);
});

```

**Queues Get waiting messages from a queue Example:**

#### Request: `QueuesPullWaitngMessagesRequest` class attributes

| Name | Type | Description | Default Value | Mandatory |

|-----------------------------|--------|------------------------------------------------------|---------------|-----------|

| channel | String | The channel to poll messages from. | None | Yes |

| maxNumberOfMessages | int | The maximum number of messages to poll. | 1 | No |

| waitTimeoutSeconds | int | The wait timeout in seconds for polling messages. | 60 | No |

  
  

#### Response: `QueuesPullWaitingMessagesResponse` class attributes

| Name | Type | Description |

|-----------------------|-----------------------------------|---------------------------------------------------------|

| id | String | The reference ID of the request. |

| messagesReceived | number | number of valid messages received. |

| messages | `QueueMessage[]` | The list of received queue messages. |

| error | String | The error message, if any error occurred. |

| isError | boolean | Indicates if there was an error. |

| isPeek. | boolean | Indicates is peak or pul. |

| messagesExpired | number | number of expired messages from the queue |

  

```typescript

await  queuesClient
.waiting({
	channel:  'queues.peek',
	maxNumberOfMessages:  5,
	waitTimeoutSeconds:  20,
})

.then((response) => {
	response.messages.forEach((msg) => {
	console.log(msg);
});
})
.catch((reason) => {
	console.error(reason);
});

```

  

# KubeMQ Command & Query Client Examples

  

Below examples demonstrating the usage of KubeMQ CQ (Commands and Queries) Client. The examples include creating, deleting, listing channels, and sending/subscribing to command and query messages.

  

## Project Structure

#### Command

-  `command\creates.ts`: Demonstrates creating command channels.

-  `command\deletes.ts`: Demonstrates deleting command channels.

-  `command\list.ts`: Demonstrates listing command channels.

-  `command\send_receive.ts`: Demonstrates sending and subscribing to command messages.

  

#### Queries

-  `queries\creates.ts`: Demonstrates creating queries channels.

-  `queries\deletes.ts`: Demonstrates deleting queries channels.

-  `queries\list.ts`: Demonstrates listing queries channels.

-  `queries\send_receive.ts`: Demonstrates sending and subscribing to queries messages.

## Getting Started

  

### Construct the CQClient

For executing command & query operation we have to create the instance of CQClient, it's instance can created with minimum two parameter `address` (KubeMQ server address) & `clientId` . With these two parameter plainText connection are established. Below Table Describe the Parameters available for establishing connection.

### CQClient Accepted Configuration

  

| Name | Type | Description | Default Value | Mandatory |

|--------------------------|----------|---------------------------------------------------------------|-------------------------|-----------|

| address | String | The address of the KubeMQ server. | None | Yes |

| clientId | String | The client ID used for authentication. | None | Yes |

| authToken | String | The authorization token for secure communication. | None | No |

| tls | boolean | Indicates if TLS (Transport Layer Security) is enabled. | None | No |

| tlsCertFile | String | The path to the TLS certificate file. | None | No (Yes if `tls` is true) |

| tlsKeyFile | String | The path to the TLS key file. | None | No (Yes if `tls` is true) |

| maxReceiveSize | int | The maximum size of the messages to receive (in bytes). | 104857600 (100MB) | No |

| reconnectIntervalSeconds | int | The interval in seconds between reconnection attempts. | 5 | No |

| keepAlive | boolean | Indicates if the connection should be kept alive. | None | No |

| pingIntervalInSeconds | int | The interval in seconds between ping messages. | None | No |

| pingTimeoutInSeconds | int | The timeout in seconds for ping messages. | None | No |

| logLevel | Level | The logging level to use. | Level. INFO | No |

  

### CQClient establishing connection example code

```typescript

const  opts: Config = {
	address:  'localhost:50000',
	clientId:  Utils.uuid(),
	reconnectInterval:  1000,
};

const  cqClient = new  CQClient(opts);

```

Below example demonstrate to construct CQClient with ssl and other configurations:

```typescript

const  config: Config = {
	address:  'localhost:50000', // KubeMQ gRPC endpoint address
	clientId:  'your-client-id', // Connection clientId
	authToken:  'your-jwt-auth-token', // Optional JWT authorization token
	tls:  true, // Indicates if TLS is enabled
	tlsCertFile:  'path/to/tls-cert.pem', // Path to the TLS certificate file
	tlsKeyFile:  'path/to/tls-key.pem', // Path to the TLS key file
	maxReceiveSize:  1024 * 1024 * 100, // Maximum size of the messages to receive (100MB)
	reconnectInterval:  1000, // Interval in milliseconds between reconnect attempts (1 second)
	keepAlive:  true, // Indicates if the connection should be kept alive
	pingIntervalInSeconds:  60, // Interval in seconds between ping messages
	pingTimeoutInSeconds:  30, // Timeout in seconds for ping messages
	logLevel:  'INFO', // Logging level for the client
	credentials: {
	cert:  Buffer.from('your-cert-content'), // Optional client cert credentials for talking to KubeMQ
	key:  Buffer.from('your-key-content'),
	caCert:  Buffer.from('your-ca-cert-content') // Optional CA certificate
}
}
const  cqClient = new  CQClient(opts);

```

  

**Ping To KubeMQ server**

You can ping the server to check connection is established or not.

#### Request: `NONE`

  
  

#### Response: `ServerInfo` interface Attributes

  

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| host | String | The host of the server. |

| version | String | The version of the server. |

| serverStartTime | long | The start time of the server (in seconds). |

| serverUpTimeSeconds | long | The uptime of the server (in seconds). |

  

```typescript

ServerInfo  pingResult = cqClient.ping();
console.log('Ping Response: ' + pingResult);

```

  

**Command CreateCommandsChannel Example:**

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to create | None | Yes |

  
  

#### Response:

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| isChannelCreated | boolean| Channel created true/false|

----------------------------------------------------------------------------

```typescript

async  function  create(channel: string) {
	return  cqClient.createCommandsChannel(channel);
}
```

**Queries CreateQueriesChannel Example:**

  

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to create | None | Yes |

  
  

#### Response:

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| isChannelCreated | boolean| Channel created true/false|

----------------------------------------------------------------------------

```typescript

async  function  create(channel: string) {
	return  cqClient.createQueriesChannel(channel);
}

```

**Command ListCommandsChannel Example:**

  

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| searchString | String | Channel name which you want to search | None | No |

  
  

#### Response: `CQChannel[]`  `CQChannel` interface attributes

  

| Name | Type | Description |

|---------------|-----------|--------------------------------------------------|

| name | String | The name of the channel. |

| type | String | The type of the channel. |

| lastActivity | long | The timestamp of the last activity on the channel. |

| isActive | boolean | Indicates whether the channel is currently active. |

| incoming | CQStats | Statistics about incoming messages to the channel. |

| outgoing | CQStats | Statistics about outgoing messages from the channel. |

  

```typescript

async  function  list(search: string) {
	const  channels = await  cqClient.listCommandsChannels(search);
	console.log(channels);
}

```

**Queries ListQueriesChannel Example:**

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| searchString | String | Channel name which you want to search | None | No |

  
  

#### Response: `List<CQChannel>`  `CQChannel` class attributes

  

| Name | Type | Description |

|---------------|-----------|--------------------------------------------------|

| name | String | The name of the channel. |

| type | String | The type of the channel. |

| lastActivity | long | The timestamp of the last activity on the channel. |

| isActive | boolean | Indicates whether the channel is currently active. |

| incoming | CQStats | Statistics about incoming messages to the channel. |

| outgoing | CQStats | Statistics about outgoing messages from the channel. |

  

```typescript

async  function  list(search: string) {
	const  channels = await  cqClient.listQueriesChannels(search);
	console.log(channels);
}

```

**Command SubscribeToCommandsChannel Example:**

#### Request: `CommandsSubscription` Class Attributes

| Name | Type | Description | Default Value | Mandatory |

|--------------------------|---------------------------------------|--------------------------------------------------------|---------------|-----------|

| channel | String | The channel for the subscription. | None | Yes |

| group | String | The group associated with the subscription. | None | No |

| onReceiveCommandCallback | `CommandsReceiveMessage` | Callback function for receiving commands. | None | Yes |

  
  

#### Response: `None`

#### Callback: `CommandsReceiveMessage` interface attributes

| Name | Type | Description |

|------------------|-----------------------|------------------------------------------------|

| commandReceived | CommandsReceiveMessage| The command message that was received. |

| clientId | String | The ID of the client that sent the command. |

| requestId | String | The ID of the request. |

| isExecuted | boolean | Indicates whether the command was executed. |

| timestamp | LocalDateTime | The timestamp of the response. |

| error | String | The error message if an error occurred. |

  
  

```typescript

const  cb = (err: Error | null, msg: CommandsReceiveMessage) => {
if (err) {
	console.error(err);
	return;
}

if (msg) {
console.log(msg);
	cqClient.sendCommandResponseMessage({
	executed:  true,
	error:  '',
	replyChannel:  msg.replyChannel,
	clientId:  'command-response',
	timestamp:  Date.now(),
	id:  msg.id,
})
.catch((reason) =>  console.log(reason));
}
};
 

cqClient.subscribeToCommands(
{
	channel:  'commands',
},
cb,
).then(async (value) => {
	value.onState.on((event) => {
	console.log(event);
});


await  new  Promise((r) =>  setTimeout(r, 1000000));
value.unsubscribe();
}).catch((reason) => {
console.log(reason);
});

```

  

**Queries SubscribeToQueriesChannel Example:**

#### Request: `QueriesSubscriptionRequest` Class Attributes

| Name | Type | Description | Default Value | Mandatory |

|--------------------------|---------------------------------------|--------------------------------------------------------|---------------|-----------|

| channel | String | The channel for the subscription. | None | Yes |

| group | String | The group associated with the subscription. | None | No |

| onReceiveQueriesCallback | `QueriesReceiveMessage` | Callback function for receiving queries. | None | Yes |

  
  

#### Response: `None`

#### Callback: `QueriesReceiveMessage` interface attributes

| Name | Type | Description |

|------------------|-----------------------|------------------------------------------------|

| id | String | The ID of the request. |

| channel | String | Channel name from which message received. |

| metadata | string | Metadata of the message. |

| body | Uint8Array | The body of the response. |

| tags | Map<string, string> | Tags to the queries message. |

| replyChannel | String | The reply channel for this message. |

  
  

```typescript

const  cb = (err: Error | null, msg) => {
	if (err) {
	console.error(err);
	return;
	}

if (msg) {
	console.log(msg);
	cqClient.sendQueryResponseMessage({
	executed:  true,
	error:  '',
	replyChannel:  msg.replyChannel,
	clientId:  'query-response',
	timestamp:  Date.now(),
	id:  msg.id,
	metadata:  'some metadata',
	body:  Utils.stringToBytes('Im here'),
}).catch((reason) =>  console.log(reason));
}
};

cqClient.subscribeToQueries(
{
	channel:  'queries',
},
cb,
).then(async (value) => {
	value.onState.on((event) => {
	console.log(event);
});


await  new  Promise((r) =>  setTimeout(r, 1000000));
value.unsubscribe();
}).catch((reason) => {
	console.log(reason);
});

```

  

**Command DeleteCommandsChannel Example:**

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to delete | None | Yes |

  
  

#### Response:

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| void | Promise<void>| Channel deleted return no result|

----------------------------------------------------------------------------

  

```typescript

async  function  deleteChannel(channel: string) {
	return  cqClient.deleteCommandsChannel(channel);
}

```

**Queries DeleteQueriesChannel Example:**

  

#### Request:

| Name | Type | Description | Default Value | Mandatory |

|---------------------|--------|--------------------------------------------|---------------|-----------|

| channelName | String | Channel name which you want to delete | None | Yes |

  
  

#### Response:

| Name | Type | Description |

|---------------------|--------|--------------------------------------------|

| void | Promise<void>| Channel deleted return no result|

----------------------------------------------------------------------------

  

```typescript

async  function  deleteChannel(channel: string) {
	return  cqClient.deleteQueriesChannel(channel);
}

```

  

## Learn KubeMQ

Visit our [Extensive KubeMQ Documentation](https://docs.kubemq.io/).

  

## Examples - Cookbook Recipes

Please visit our cookbook [repository](https://github.com/kubemq-io/node-sdk-cookbook)

  
  

## Support

if you encounter any issues, please open an issue here,

In addition, you can reach us for support by:

- [**Email**](mailto://support@kubemq.io)

- [**Slack**](https://join.slack.com/t/kubemq/shared_invite/enQtNDk3NjE1Mjg1MDMwLThjMGFmYjU1NTVhZWRjZTRjYTIxM2E5MjA5ZDFkMWUyODI3YTlkOWY2MmYzNGIwZjY3OThlMzYxYjYwMTVmYWM)