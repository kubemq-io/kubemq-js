The **KubeMQ SDK for NodeJS** enables Node JS/Typescript developers to seamlessly communicate with the [KubeMQ](https://kubemq.io/) server, implementing various communication patterns such as Events, EventStore, Commands, Queries, and Queues.

# Prerequisites

- Node.js (Ensure you have a recent version of Node.js installed)

- TypeScript Compiler

- KubeMQ server running locally or accessible over the network

# Installation

The recommended way to use the SDK for Node in your project is to consume it from Node package manager.

```

npm install kubemq-js

```

# Payload Details
-  **Metadata:** The metadata allows us to pass additional information with the event. Can be in any form that can be presented as a string, i.e., struct, JSON, XML and many more.
-  **Body:** The actual content of the event. Can be in any form that is serializable into a byte array, i.e., string, struct, JSON, XML, Collection, binary file and many more.
-  **ClientID:** Displayed in logs, tracing, and KubeMQ dashboard(When using Events Store, it must be unique).
-  **Tags:** Set of Key-value pair that help categorize the message

# KubeMQ PubSub Client 


For executing PubSub operation we have to create the instance of PubsubClient, its instance can be created with minimum two parameter `address` (KubeMQ server address) & `clientId` . With these two parameter plainText connections are established. The table below describes the Parameters available for establishing a connection.

## PubSub Client Configuration

| Name                     | Type    | Description                                             | Default Value     | Mandatory |
|--------------------------|---------|---------------------------------------------------------|-------------------|-----------|
| address                  | String  | The address of the KubeMQ server.                       | None              | Yes       |
| clientId                 | String  | The client ID used for authentication.                  | None              | Yes       |
| authToken                | String  | The authorization token for secure communication.       | None              | No        |
| tls                      | boolean | Indicates if TLS (Transport Layer Security) is enabled. | None              | No        |
| tlsCertFile              | String  | The path to the TLS certificate file.                   | None              | No (Yes if `tls` is true) |
| tlsKeyFile               | String  | The path to the TLS key file.                           | None              | No (Yes if `tls` is true) |
| tlsCaCertFile            | String  | The path to the TLS CA cert file.                   | None              | No (Yes if `tls` is true) |
| maxReceiveSize           | int     | The maximum size of the messages to receive (in bytes). | 104857600 (100MB) | No        |
| reconnectIntervalSeconds | int     | The interval in seconds between reconnection attempts.  | 1                 | No        |

## Pubsub Client connection establishment example code

```typescript

const  opts: Config = {
	address:  'localhost:50000',
	clientId:  Utils.uuid(),
	reconnectIntervalSeconds:  1,
};

const  pubsubClient = new  PubsubClient(opts);

```

The example below demonstrates to construct PubSubClient with ssl and other configurations:

```typescript

const  config: Config = {

	address:  'localhost:50000', // KubeMQ gRPC endpoint address
	clientId:  'your-client-id', // Connection clientId
	authToken:  'your-jwt-auth-token', // Optional JWT authorization token
	tls:  true, // Indicates if TLS is enabled
	tlsCertFile:  'path/to/tls-cert.pem', // Path to the TLS certificate file
	tlsKeyFile:  'path/to/tls-key.pem', // Path to the TLS key file
	tlsCaCertFile:  'path/to/tls-key.pem', // Path to the TLS key file
	maxReceiveSize:  1024 * 1024 * 100, // Maximum size of the messages to receive (100MB)
	reconnectIntervalSeconds:  1 // Interval in milliseconds between reconnect attempts (1 second)
};

```

**Ping To KubeMQ server**

You can ping the server to check connection is established or not.

#### Request: `NONE`

#### Response: `ServerInfo` Interface Attributes

| Name               | Type   | Description                              |
|--------------------|--------|------------------------------------------|
| host               | String | The host of the server.                  |
| version            | String | The version of the server.               |
| serverStartTime    | long   | The start time of the server (in seconds).|
| serverUpTimeSeconds| long   | The uptime of the server (in seconds).    |

```typescript

ServerInfo  pingResult = pubsubClient.ping();
console.log('Ping Response: ' + pingResult);

```
## Create Channel

**PubSub CreateEventsChannel Example:**

### Request:

| Name        | Type   | Description                           | Default Value | Mandatory |
|-------------|--------|---------------------------------------|---------------|-----------|
| channelName | String | Channel name which you want to create | None          | Yes       |


### Response:

| Name | Type          | Description                           |
|------|---------------|---------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |

```typescript

async  function  createEventsChannel(channel: string) {
return  pubsubClient.createEventsChannel(channel);
}

```

**PubSub Create Events Store Channel Example:**

### Request:

| Name        | Type   | Description                              | Default Value | Mandatory |
|-------------|--------|------------------------------------------|---------------|-----------|
| channelName | String | Channel name to which you want to create | None          | Yes       |


### Response:

| Name | Type          | Description                            |
|------|---------------|----------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |


----------------------------------------------------------------------------

```typescript

async  function  createEventsStoreChannel(channel: string) {
return  pubsubClient.createEventsStoreChannel(channel);
}

```

## Delete Channel

**PubSub DeleteEventsChannel Example:**

### Request:

| Name        | Type   | Description                             | Default Value | Mandatory |
|-------------|--------|-----------------------------------------|---------------|-----------|
| channelName | String | Channel name which you want to delete   | None          | Yes       |


### Response:

| Name | Type          | Description                           |
|------|---------------|---------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |

```typescript

async  function  deleteEventsChannel(channel: string) {
return  pubsubClient.deleteEventsChannel(channel);
}

```

**PubSub Delete Events Store Channel Example:**

### Request:

| Name        | Type   | Description                              | Default Value | Mandatory |
|-------------|--------|------------------------------------------|---------------|-----------|
| channelName | String | Channel name to which you want to delete | None          | Yes       |


### Response:

| Name | Type          | Description                            |
|------|---------------|----------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |

```typescript

async  function  deleteEventsStoreChannel(channel: string) {
return  pubsubClient.deleteEventsStoreChannel(channel);
}

```
## List Channels

**PubSub ListEventsChannel Example:**

### Request:

| Name   | Type   | Description                               | Default Value | Mandatory |
|--------|--------|-------------------------------------------|---------------|-----------|
| search | String | Search query to filter channels (optional)  | None          | No        |


### Response: `PubSubChannel[]`  `PubSubChannel` interface Attributes

| Name        | Type        | Description                                                                                      |
|-------------|-------------|--------------------------------------------------------------------------------------------------|
| name        | String      | The name of the Pub/Sub channel.                                                                 |
| type        | String      | The type of the Pub/Sub channel.                                                                 |
| lastActivity| long        | The timestamp of the last activity on the channel, represented in milliseconds since epoch.       |
| isActive    | boolean     | Indicates whether the channel is active or not.                                                  |
| incoming    | PubSubStats | The statistics related to incoming messages for this channel.                                     |
| outgoing    | PubSubStats | The statistics related to outgoing messages for this channel.                                     |

```typescript

async  function  listEventsChannel(search: string) {
	const  channels = await  pubsubClient.listEventsChannels(search);
	console.log(channels);
}

```

**PubSub ListEventsStoreChannel Example:**

### Request:

| Name        | Type   | Description                               | Default Value | Mandatory |
|-------------|--------|-------------------------------------------|---------------|-----------|
| search | String | Search query to filter channels (optional)  | None          | No        |

### Response: `PubSubChannel[]`  `PubSubChannel` interface Attributes

| Name         | Type        | Description                                                                                  |
|--------------|-------------|----------------------------------------------------------------------------------------------|
| name         | String      | The name of the Pub/Sub channel.                                                             |
| type         | String      | The type of the Pub/Sub channel.                                                             |
| lastActivity | long        | The timestamp of the last activity on the channel, represented in milliseconds since epoch.   |
| isActive     | boolean     | Indicates whether the channel is active or not.                                              |
| incoming     | PubSubStats | The statistics related to incoming messages for this channel.                                 |
| outgoing     | PubSubStats | The statistics related to outgoing messages for this channel.                                 |

```typescript

async  function  listEventsStoreChannel(search: string) {
	const  channels = await  pubsubClient.listEventsStoreChannels(search);
	console.log(channels);
}

```

## PubSub Send & Receive
**PubSub SendEventMessage Example:**

### Request: `EventMessage` Interface Attributes


| Name     | Type                  | Description                                              | Default Value    | Mandatory |
|----------|-----------------------|----------------------------------------------------------|------------------|-----------|
| id       | String                | Unique identifier for the event message.                | None             | No        |
| channel  | String                | The channel to which the event message is sent.         | None             | Yes       |
| metadata | String                | Metadata associated with the event message.             | None             | No        |
| body     | byte[]                | Body of the event message in bytes.                     | Empty byte array | No        |
| tags     | Map<String, String>   | Tags associated with the event message as key-value pairs. | Empty Map       | No        |


**Note:-**  `metadata` or `body` or `tags` any one is required

### Response: `NONE`

```typescript

await  pubsubClient.sendEventsMessage({
	id:  `234`,
	channel: 'events.single',
	body:  Utils.stringToBytes('event message'),
});

```

**PubSub SendEventStoreMessage Example:**

### Request: `EventStoreMessage` Class Attributes

| Name     | Type                  | Description                                              | Default Value    | Mandatory |
|----------|-----------------------|----------------------------------------------------------|------------------|-----------|
| id       | String                | Unique identifier for the event message.                | None             | No        |
| channel  | String                | The channel to which the event message is sent.         | None             | Yes       |
| metadata | String                | Metadata associated with the event message.             | None             | No        |
| body     | byte[]                | Body of the event message in bytes.                     | Empty byte array | No        |
| tags     | Map<String, String>   | Tags associated with the event message as key-value pairs. | Empty Map       | No        |


**Note:-**  `metadata` or `body` or `tags` any one is required

### Response: `NONE`

```typescript

await  pubsubClient.sendEventStoreMessage({
	id:  '987',
	channel: 'events_store.single',
	body:  Utils.stringToBytes('event store message'),
});

```

**PubSub SubscribeEvents Example:**

### Request: `EventsSubscription` Class Attributes


| Name                    | Type                               | Description                                                               | Default Value | Mandatory |
|-------------------------|------------------------------------|---------------------------------------------------------------------------|---------------|-----------|
| channel                 | String                             | The channel to subscribe to.                                                | None          | Yes       |
| group                   | String                             | The group to subscribe with.                                                | None          | No        |
| onReceiveEventCallback   | Consumer<EventMessageReceived>    | Callback function to be called when an event message is received.          | None          | Yes       |
| onErrorCallback         | Consumer<String>                   | Callback function to be called when an error occurs.                       | None          | No        |


### Response: `NONE`

## Callback: `EventMessageReceived` class details

| Name        | Type                  | Description                                                        |
|-------------|-----------------------|--------------------------------------------------------------------|
| id          | String                | The unique identifier of the message.                             |
| fromClientId| String                | The ID of the client that sent the message.                       |
| timestamp   | long                  | The timestamp when the message was received, in seconds.           |
| channel     | String                | The channel to which the message belongs.                         |
| metadata    | String                | The metadata associated with the message.                         |
| body        | byte[]                | The body of the message.                                          |
| sequence    | long                  | The sequence number of the message.                               |
| tags        | Map<String, String>   | The tags associated with the message.                             |

```typescript
async function subscribeToEvent() {  
  //Subscribes to events from the specified channel and processes received events.  
  const eventsSubscriptionRequest = new EventsSubscriptionRequest('events.A', '');  
  
  // Define the callback for receiving events  
  eventsSubscriptionRequest.onReceiveEventCallback = (event: EventMessageReceived) => {  
    console.log('SubscriberA received event:', {  
      id: event.id,  
      fromClientId: event.fromClientId,  
      timestamp: event.timestamp,  
      channel: event.channel,  
      metadata: event.metadata,  
      body: event.body,  
      tags: event.tags,  
    });  
  };  
  
  // Define the callback for handling errors  
  eventsSubscriptionRequest.onErrorCallback = (error: string) => {  
    console.error('SubscriberA error:', error);  
  };  
  
  pubsubClient  
  .subscribeToEvents(eventsSubscriptionRequest)  
    .then(() => {  
      console.log('Subscription successful');  
    })  
    .catch((reason: any) => {  
      console.error('Subscription failed:', reason);  
    });  
  
}
```

**PubSub SubscribeEventsStore Example:**

### Request: `EventsStoreSubscription` Interface Attributes


| Name                     | Type                                    | Description                                                             | Default Value | Mandatory |
|--------------------------|-----------------------------------------|-------------------------------------------------------------------------|---------------|-----------|
| channel                  | String                                  | The channel to subscribe to.                                             | None          | Yes       |
| group                    | String                                  | The group to subscribe with.                                             | None          | No        |
| onReceiveEventCallback    | Consumer<EventStoreMessageReceived>    | Callback function to be called when an event message is received.       | None          | Yes       |
| onErrorCallback          | Consumer<String>                       | Callback function to be called when an error occurs.                    | None          | No        |

### Response: `None`

## Callback: `EventStoreMessageReceived` class details

| Name        | Type                  | Description                                                        |
|-------------|-----------------------|--------------------------------------------------------------------|
| id          | String                | The unique identifier of the message.                             |
| fromClientId| String                | The ID of the client that sent the message.                       |
| timestamp   | long                  | The timestamp when the message was received, in seconds.           |
| channel     | String                | The channel to which the message belongs.                         |
| metadata    | String                | The metadata associated with the message.                         |
| body        | byte[]                | The body of the message.                                          |
| sequence    | long                  | The sequence number of the message.                               |
| tags        | Map<String, String>   | The tags associated with the message.                             |

```typescript
async function subscribeToEventStore() {  
  //Subscribes to events store messages from the specified channel with a specific configuration.  
  const eventsSubscriptionRequest = new EventsStoreSubscriptionRequest('events_store.A', '');  
  eventsSubscriptionRequest.eventsStoreType = EventStoreType.StartAtSequence;  
  eventsSubscriptionRequest.eventsStoreSequenceValue=1;  
  
  // Define the callback for receiving events  
  eventsSubscriptionRequest.onReceiveEventCallback = (event: EventStoreMessageReceived) => {  
    console.log('SubscriberA received event:', {  
      id: event.id,  
      fromClientId: event.fromClientId,  
      timestamp: event.timestamp,  
      channel: event.channel,  
      metadata: event.metadata,  
      body: event.body,  
      tags: event.tags,  
      sequence: event.sequence,  
    });  
  };  
  
  // Define the callback for handling errors  
  eventsSubscriptionRequest.onErrorCallback = (error: string) => {  
    console.error('SubscriberA error:', error);  
  };  
  
  pubsubClient  
  .subscribeToEvents(eventsSubscriptionRequest)  
    .then(() => {  
      console.log('Events Subscription successful');  
    })  
    .catch((reason: any) => {  
      console.error('Event Subscription failed:', reason);  
    });  
}
```

# KubeMQ Queues Operations

The examples below demonstrate the usage of KubeMQ Queues client. The examples include creating, deleting, listing channels, and sending/receiving queues messages.

## Construct the Queues Client

For executing Queues operation we have to create the instance of QueuesClient, its instance can be created with minimum two parameter `address` (KubeMQ server address) & `clientId` . With these two parameter plainText connections are established. The table below describes the Parameters available for establishing a connection.

## QueuesClient Configuration

| Name                     | Type    | Description                                                | Default Value     | Mandatory |
|--------------------------|---------|------------------------------------------------------------|-------------------|-----------|
| address                  | String  | The address of the KubeMQ server.                         | None              | Yes       |
| clientId                 | String  | The client ID used for authentication.                     | None              | Yes       |
| authToken                | String  | The authorization token for secure communication.          | None              | No        |
| tls                      | boolean | Indicates if TLS (Transport Layer Security) is enabled.    | None              | No        |
| tlsCertFile              | String  | The path to the TLS certificate file.                      | None              | No (Yes if `tls` is true) |
| tlsKeyFile               | String  | The path to the TLS key file.                              | None              | No (Yes if `tls` is true) |
| tlsCaCertFile            | String  | The path to the TLS CA cert file.                   | None              | No (Yes if `tls` is true) |
| maxReceiveSize           | int     | The maximum size of the messages to receive (in bytes).    | 104857600 (100MB) | No        |
| reconnectIntervalSeconds | int     | The interval in seconds between reconnection attempts.     | 1                 | No        |

## Queues Client establishing a connection example code

```typescript

const  opts: Config = {
	address:  'localhost:50000',
	clientId:  Utils.uuid(),
};

const  queuesClient = new  QueuesClient(opts);

```

The example below demonstrates to construct PubSubClient with ssl and other configurations:

```typescript
const  opts: Config = {
	address:  'localhost:50000', // KubeMQ gRPC endpoint address
	clientId:  'your-client-id', // Connection clientId
	authToken:  'your-jwt-auth-token', // Optional JWT authorization token
	tls:  true, // Indicates if TLS is enabled
	tlsCertFile:  'path/to/tls-cert.pem', // Path to the TLS certificate file
	tlsKeyFile:  'path/to/tls-key.pem', // Path to the TLS key file
	tlsCaCertFile:  'path/to/tls-ca-cert.pem', // Path to the TLS CA cert file
	maxReceiveSize:  1024 * 1024 * 100, // The Maximum size of the messages to receive (100MB)
	reconnectIntervalSeconds:  1 // Interval in milliseconds between reconnect attempts (1 second)
};

const  queuesClient = new  QueuesClient(opts);
```

**Ping To KubeMQ server**

You can ping the server to check connection is established or not.

### Request: `NONE`

### Response: `ServerInfo` Class Attributes


| Name             | Type  | Description                                          |
|------------------|-------|------------------------------------------------------|
| host             | String| The host of the server.                            |
| version          | String| The version of the server.                         |
| serverStartTime  | long  | The start time of the server (in seconds).         |
| serverUpTimeSeconds | long  | The uptime of the server (in seconds).             |

```typescript

const  pingResult = queuesClient.ping();
console.log('Ping Response: ' + pingResult);

```
## Create Channel

**Queues CreateQueueChannel Example:**

### Request:
| Name         | Type   | Description                              | Default Value | Mandatory |
|--------------|--------|------------------------------------------|---------------|-----------|
| channelName  | String | The name of the channel you want to create | None          | Yes       |


### Response:

| Name | Type          | Description                           |
|------|---------------|---------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |

```typescript

async  function  createQueueChannel(channel: string) {
	return  queuesClient.createQueuesChannel(channel);
}

```

## Delete Channel

**Queues DeleteQueueChannel Example:**

### Request:
| Name         | Type   | Description                                | Default Value | Mandatory |
|--------------|--------|--------------------------------------------|---------------|-----------|
| channelName  | String | The name of the channel you want to delete | None          | Yes       |


### Response:

| Name | Type          | Description                           |
|------|---------------|---------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |

```typescript

async  function  createQueueChannel(channel: string) {
	return  queuesClient.deleteQueuesChannel(channel);
}

```

## List Channels

**Queues listQueueChannels Example:**

### Request:

| Name          | Type   | Description                              | Default Value | Mandatory |
|---------------|--------|------------------------------------------|---------------|-----------|
| searchString  | String | The channel name you want to search for | None          | No        |


### Response: `QueuesChannel[]` QueuesChannel interface Attributes

| Name            | Type          | Description                                              |
|-----------------|---------------|----------------------------------------------------------|
| name            | String        | The name of the queue channel.                          |
| type            | String        | The type of the queue channel.                          |
| lastActivity    | long          | The timestamp of the last activity in the queue channel.|
| isActive        | boolean       | Indicates whether the queue channel is currently active.|
| incoming        | QueuesStats   | The statistics for incoming messages in the queue channel. |
| outgoing        | QueuesStats   | The statistics for outgoing messages in the queue channel. |


```typescript

async  function  listQueueChannels(search: string) {
	const  channels = await  queuesClient.listQueuesChannel(search);
	console.log(channels);
}

```
## Send & Receive Queue Messages

**Queues SendSingleMessage Example:**

### Request: `QueueMessage` class attributes

| Name                          | Type                 | Description                                                                                 | Default Value    | Mandatory |
|-------------------------------|----------------------|---------------------------------------------------------------------------------------------|------------------|-----------|
| id                             | String               | The unique identifier for the message.                                                      | None             | No        |
| channel                        | String               | The channel of the message.                                                                 | None             | Yes       |
| metadata                       | String               | The metadata associated with the message.                                                   | None             | No        |
| body                           | byte[]               | The body of the message.                                                                    | new byte[0]      | No        |
| tags                           | Map<String, String>  | The tags associated with the message.                                                       | new HashMap<>()  | No        |
| delayInSeconds                 | int                  | The delay in seconds before the message becomes available in the queue.                     | None             | No        |
| expirationInSeconds            | int                  | The expiration time in seconds for the message.                                             | None             | No        |
| attemptsBeforeDeadLetterQueue  | int                  | The number of receive attempts allowed before the message is moved to the dead letter queue. | None             | No        |
| deadLetterQueue                | String               | The dead letter queue where the message will be moved after reaching max receive attempts.   | None             | No        |


### Response: `QueueSendResult` class attributes

| Name      | Type           | Description                                                     |
|-----------|----------------|-----------------------------------------------------------------|
| id        | String          | The unique identifier of the message.                           |
| sentAt    | LocalDateTime   | The timestamp when the message was sent.                        |
| expiredAt | LocalDateTime   | The timestamp when the message will expire.                     |
| delayedTo | LocalDateTime   | The timestamp when the message will be delivered.               |
| isError   | boolean         | Indicates if there was an error while sending the message.       |
| error     | String          | The error message if `isError` is true.                         |

```typescript

await  queuesClient.sendQueuesMessage({
	channel:  'queues.single',
	body:  Utils.stringToBytes('queue message'),
})
.then((result) =>  console.log(result))
.catch((reason) =>  console.error(reason));
```

**Queues Pulls messages from a queue. Example:**

### Request: `QueuesPullWaitingMessagesRequest` class attributes

| Name                | Type   | Description                                | Default Value | Mandatory |
|---------------------|--------|--------------------------------------------|---------------|-----------|
| channel             | String | The channel to poll messages from.         | None          | Yes       |
| maxNumberOfMessages | int    | The maximum number of messages to poll.    | 1             | No        |
| waitTimeoutSeconds  | int    | The wait timeout in seconds for polling messages. | 60        | No        |



### Response: `QueuesPullWaitingMessagesResponse` class attributes
| Name             | Type              | Description                                         |
|------------------|-------------------|-----------------------------------------------------|
| id               | String            | The reference ID of the request.                    |
| messagesReceived | number            | Number of valid messages received.                  |
| messages         | `QueueMessage[]`  | The list of received queue messages.                |
| error            | String            | The error message, if any error occurred.           |
| isError          | boolean           | Indicates if there was an error.                    |
| isPeek           | boolean           | Indicates if it is a peek or pull operation.        |
| messagesExpired  | number            | Number of expired messages from the queue.          |


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

### Request: `QueuesPullWaitngMessagesRequest` class attributes
| Name               | Type   | Description                                        | Default Value | Mandatory |
|--------------------|--------|----------------------------------------------------|---------------|-----------|
| channel            | String | The channel to poll messages from.                 | None          | Yes       |
| maxNumberOfMessages| int    | The maximum number of messages to poll.            | 1             | No        |
| waitTimeoutSeconds | int    | The wait timeout in seconds for polling messages.  | 60            | No        |


### Response: `QueuesPullWaitingMessagesResponse` class attributes

| Name             | Type              | Description                                      |
|------------------|-------------------|--------------------------------------------------|
| id               | String            | The reference ID of the request.                 |
| messagesReceived | number            | Number of valid messages received.               |
| messages         | `QueueMessage[]`  | The list of received queue messages.             |
| error            | String            | The error message, if any error occurred.        |
| isError          | boolean           | Indicates if there was an error.                 |
| isPeek           | boolean           | Indicates if the operation is a peek or pull.    |
| messagesExpired  | number            | Number of expired messages from the queue.       |

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

## Poll Queue Messages

Receives messages from a Queue channel.

### Request: `QueuesPollRequest` Class Attributes

| Name                     | Type    | Description                                          | Default Value | Mandatory |
|--------------------------|---------|------------------------------------------------------|---------------|-----------|
| channel                  | String  | The channel to poll messages from.                   | None          | Yes       |
| pollMaxMessages          | int     | The maximum number of messages to poll.              | 1             | No        |
| pollWaitTimeoutInSeconds | int     | The wait timeout in seconds for polling messages.    | 60            | No        |
| autoAckMessages             | boolean| Indicates if messages should be auto-acknowledged.  | false         | No        |
| visibilitySeconds           | int| Add a visibility timeout feature for messages.  | 0         | No        |

### Response: `QueuesMessagesPulledResponse` Class Attributes

| Name                   | Type                       | Description                                             |
|------------------------|----------------------------|---------------------------------------------------------|
| id           | String                     | The reference ID of the request.                        |
| messages               | QueueMessageReceived[] | The list of received queue messages.                    |
| messagesReceived | number            | Number of valid messages received.               |
| messagesExpired | number            | Number of messages expired.               |
| isPeek           | boolean           | Indicates if the operation is a peek or pull.    |
| error                  | String                     | The error message, if any error occurred.               |
| isError                | boolean                    | Indicates if there was an error.                        |
| visibilitySeconds      | int                        | The visibility timeout for the message in seconds.      |
| isAutoAcked            | boolean                    | Indicates whether the message was auto-acknowledged.    |


#### Response: `QueueMessageReceived` class attributes
Here's the requested Markdown table for the `QueueMessageReceived` class:

| Name                  | Type                                  | Description                                             |
|-----------------------|---------------------------------------|---------------------------------------------------------|
| id                    | String                                | The unique identifier for the message.                  |
| channel               | String                                | The channel from which the message was received.         |
| metadata              | String                                | Metadata associated with the message.                   |
| body                  | byte[]                                | The body of the message in byte array format.           |
| fromClientId          | String                                | The ID of the client that sent the message.             |
| tags                  | Map`<String, String>`                 | Key-value pairs representing tags for the message.      |
| timestamp             | Instant                               | The timestamp when the message was created.             |
| sequence              | long                                  | The sequence number of the message.                     |
| receiveCount          | int                                   | The number of times the message has been received.       |
| isReRouted            | boolean                               | Indicates whether the message was rerouted.             |
| reRouteFromQueue      | String                                | The name of the queue from which the message was rerouted.|
| expiredAt             | Instant                               | The expiration time of the message, if applicable.      |
| delayedTo             | Instant                               | The time the message is delayed until, if applicable.   |
| transactionId         | String                                | The transaction ID associated with the message.         |
| isTransactionCompleted| boolean                               | Indicates whether the transaction for the message is completed. |
| responseHandler       | StreamObserver`<QueuesDownstreamRequest>` | The response handler for processing downstream requests. |
| receiverClientId      | String                                | The ID of the client receiving the message.             |
| visibilitySeconds     | int                                   | The visibility timeout for the message in seconds.      |
| isAutoAcked           | boolean                               | Indicates whether the message was auto-acknowledged.     |

## Example

```typescript
async function main() {  
  const opts: Config = {  
    address: 'localhost:50000',  
    clientId: 'kubeMQClientId-ts',  
  };  
  const queuesClient = new QueuesClient(opts);  
  
  // Receive with message visibility  
  async function receiveWithVisibility(visibilitySeconds: number) {  
    console.log("\n============================== Receive with Visibility =============================\n");  
    try {  
      const pollRequest = new QueuesPollRequest({  
        channel: 'visibility_channel',  
        pollMaxMessages: 1,  
        pollWaitTimeoutInSeconds: 10,  
        visibilitySeconds: visibilitySeconds,  
        autoAckMessages: false,  
      });  
  
      const pollResponse = await queuesClient.receiveQueuesMessages(pollRequest);  
      console.log("Received Message Response:", pollResponse);  
        
      if (pollResponse.isError) {  
        console.log("Error: " + pollResponse.error);  
      } else {  
        pollResponse.messages.forEach(async (msg) => {  
          console.log(`Message ID: ${msg.id}, Message Body: ${Utils.bytesToString(msg.body)}`);  
          try {  
            await new Promise(resolve => setTimeout(resolve, 1000));  
            await msg.ack();  
            console.log("Acknowledged message");  
          } catch (err) {  
            console.error("Error acknowledging message:", err);  
          }  
        });  
      }  
    } catch (error) {  
      console.error('Failed to receive queue messages:', error);  
    }  
  }  
  
  // Test visibility expiration  
  async function receiveWithVisibilityExpired() {  
    console.log("\n============================== Receive with Visibility Expired =============================\n");  
    await receiveWithVisibility(2);  
  }  
  
  // Test visibility extension  
  async function receiveWithVisibilityExtension() {  
    console.log("\n============================== Receive with Visibility Extension =============================\n");  
    try {  
      const pollRequest = new QueuesPollRequest({  
        channel: 'visibility_channel',  
        pollMaxMessages: 1,  
        pollWaitTimeoutInSeconds: 10,  
        visibilitySeconds: 3,  
        autoAckMessages: false,  
      });  
  
      const pollResponse = await queuesClient.receiveQueuesMessages(pollRequest);  
      console.log("Received Message Response:", pollResponse);  
  
      if (pollResponse.isError) {  
        console.log("Error: " + pollResponse.error);  
      } else {  
        pollResponse.messages.forEach(async (msg) => {  
          console.log(`Message ID: ${msg.id}, Message Body: ${Utils.bytesToString(msg.body)}`);  
          try {  
            await new Promise(resolve => setTimeout(resolve, 1000));  
            await msg.extendVisibilityTimer(3);  
            await new Promise(resolve => setTimeout(resolve, 2000));  
            await msg.ack();  
            console.log("Acknowledged message after extending visibility");  
          } catch (err) {  
            console.error("Error during visibility extension:", err);  
          }  
        });  
      }  
    } catch (error) {  
      console.error('Failed to receive queue messages:', error);  
    }  
  }  
  
  await receiveWithVisibilityExpired();  
  await receiveWithVisibilityExtension();  
}  
  
main();
```

This method allows you to receive messages from a specified Queue channel. You can configure the polling behavior, including the maximum number of messages to receive and the wait timeout. The response provides detailed information about the received messages and the transaction.

### Message Handling Options:

1. **Acknowledge (ack)**: Mark the message as processed and remove it from the queue.
2. **Reject**: Reject the message. It won't be requeued.
3. **Requeue**: Send the message back to the queue for later processing.

Choose the appropriate handling option based on your application's logic and requirements.


# KubeMQ Command & Query Operations

## Construct the CQClient

For executing command & query operation we have to create the instance of CQClient, its instance can be created with minimum two parameter `address` (KubeMQ server address) & `clientId` . With these two parameter plainText connections are established. The table below describes the Parameters available for establishing a connection.

## CQClient Configuration

| Name                     | Type    | Description                                                | Default Value     | Mandatory |
|--------------------------|---------|------------------------------------------------------------|-------------------|-----------|
| address                  | String  | The address of the KubeMQ server.                         | None              | Yes       |
| clientId                 | String  | The client ID used for authentication.                     | None              | Yes       |
| authToken                | String  | The authorization token for secure communication.          | None              | No        |
| tls                      | boolean | Indicates if TLS (Transport Layer Security) is enabled.    | None              | No        |
| tlsCertFile              | String  | The path to the TLS certificate file.                      | None              | No (Yes if `tls` is true) |
| tlsKeyFile               | String  | The path to the TLS key file.                              | None              | No (Yes if `tls` is true) |
| tlsCaCertFile            | String  | The path to the TLS CA cert file.                   | None              | No (Yes if `tls` is true) |
| maxReceiveSize           | int     | The maximum size of the messages to receive (in bytes).    | 104857600 (100MB) | No        |
| reconnectIntervalSeconds | int     | The interval in seconds between reconnection attempts.     | 1                 | No        |


## CQClient establishing a connection example code

```typescript

const  opts: Config = {

    address:  'localhost:50000',
    clientId:  Utils.uuid(),
    reconnectIntervalSeconds:  1,
};

const  cqClient = new  CQClient(opts);

```

The example below demonstrates to construct CQClient with ssl and other configurations:

```typescript

const  config: Config = {

    address:  'localhost:50000', // KubeMQ gRPC endpoint address
    clientId:  'your-client-id', // Connection clientId
    authToken:  'your-jwt-auth-token', // Optional JWT authorization token
    tls:  true, // Indicates if TLS is enabled
    tlsCertFile:  'path/to/tls-cert.pem', // Path to the TLS certificate file
    tlsKeyFile:  'path/to/tls-key.pem', // Path to the TLS key file
    tlsCaCertFile:  'path/to/tls-ca-cert.pem', // Path to the TLS CA cert file
    maxReceiveSize:  1024 * 1024 * 100, // Maximum size of the messages to receive (100MB)
    reconnectIntervalSeconds:  1, // Interval in milliseconds between reconnect attempts (1 second)
};
const  cqClient = new  CQClient(opts);

```

**Ping To KubeMQ server**

You can ping the server to check connection is established or not.

#### Request: `NONE`

#### Response: `ServerInfo` interface Attributes

| Name              | Type   | Description                                  |
|-------------------|--------|----------------------------------------------|
| host              | String | The host of the server.                      |
| version           | String | The version of the server.                   |
| serverStartTime   | long   | The start time of the server (in seconds).   |
| serverUpTimeSeconds | long   | The uptime of the server (in seconds).       |

```typescript

const  pingResult = cqClient.ping();
console.log('Ping Response: ' + pingResult);

```
## Create Channel

**Command CreateCommandsChannel Example:**

#### Request:

| Name        | Type   | Description                         | Default Value | Mandatory |
|-------------|--------|-------------------------------------|---------------|-----------|
| channelName | String | Channel name which you want to create | None          | Yes       |


#### Response:

| Name | Type          | Description                           |
|------|---------------|---------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |

```typescript

async  function  createCommandsChannel(channel: string) {
    return  cqClient.createCommandsChannel(channel);
}
```

**Queries CreateQueriesChannel Example:**


#### Request:

| Name        | Type   | Description                           | Default Value | Mandatory |
|-------------|--------|---------------------------------------|---------------|-----------|
| channelName | String | The name of the channel to create.    | None          | Yes       |

#### Response:

| Name | Type          | Description                           |
|------|---------------|---------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |
```typescript

async  function  createQueriesChannel(channel: string) {
    return  cqClient.createQueriesChannel(channel);
}

```

## Delete Channel

**Command DeleteCommandsChannel Example:**

#### Request:

| Name        | Type   | Description                           | Default Value | Mandatory |
|-------------|--------|---------------------------------------|---------------|-----------|
| channelName | String | Channel name which you want to delete | None          | Yes       |


#### Response:

| Name | Type          | Description                           |
|------|---------------|---------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |

```typescript

async  function  deleteCommandsChannel(channel: string) {
    return  cqClient.deleteCommandsChannel(channel);
}
```

**Queries DeleteQueriesChannel Example:**

#### Request:

| Name        | Type   | Description                       | Default Value | Mandatory |
|-------------|--------|-----------------------------------|---------------|-----------|
| channelName | String | The name of the channel to delete | None          | Yes       |

#### Response:

| Name | Type          | Description                           |
|------|---------------|---------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |

```typescript

async  function  deleteQueriesChannel(channel: string) {
    return  cqClient.deleteQueriesChannel(channel);
}

```

## List Channels

**Command ListCommandsChannel Example:**

#### Request:
| Name          | Type   | Description                            | Default Value | Mandatory |
|---------------|--------|----------------------------------------|---------------|-----------|
| searchString  | String | The name of the channel to search for. | None          | No        |


#### Response: `CQChannel[]`  `CQChannel` interface attributes
| Name           | Type   | Description                                               |
|----------------|--------|-----------------------------------------------------------|
| name           | String | The name of the channel.                                |
| type           | String | The type of the channel.                                |
| lastActivity   | long   | The timestamp of the last activity on the channel.      |
| isActive       | boolean| Indicates whether the channel is currently active.      |
| incoming       | CQStats| Statistics about incoming messages to the channel.      |
| outgoing       | CQStats| Statistics about outgoing messages from the channel.    |

```typescript

async  function  listCommandsChannels(search: string) {
    const  channels = await  cqClient.listCommandsChannels(search);
    console.log(channels);
}

```

**Queries ListQueriesChannel Example:**

#### Request:
| Name         | Type   | Description                                   | Default Value | Mandatory |
|--------------|--------|-----------------------------------------------|---------------|-----------|
| searchString | String | Channel name which you want to search        | None          | No        |

#### Response: `List<CQChannel>`  `CQChannel` class attributes
| Name         | Type   | Description                                           |
|--------------|--------|-------------------------------------------------------|
| name         | String | The name of the channel.                            |
| type         | String | The type of the channel.                            |
| lastActivity | long   | The timestamp of the last activity on the channel.  |
| isActive     | boolean| Indicates whether the channel is currently active.  |
| incoming     | CQStats| Statistics about incoming messages to the channel.  |
| outgoing     | CQStats| Statistics about outgoing messages from the channel.|

```typescript

async  function  listQueriesChannels(search: string) {
    const  channels = await  cqClient.listQueriesChannels(search);
    console.log(channels);
}

```
## Send & Receive Command & Query Messages

**Command SubscribeToCommandsChannel Example:**

#### Request: `CommandsSubscription` Class Attributes
| Name                     | Type                    | Description                                      | Default Value | Mandatory |
|--------------------------|-------------------------|--------------------------------------------------|---------------|-----------|
| channel                  | String                  | The channel for the subscription.               | None          | Yes       |
| group                    | String                  | The group associated with the subscription.     | None          | No        |
| onReceiveCommandCallback | `CommandsReceiveMessage`| Callback function for receiving commands.       | None          | Yes       |


#### Response: `None`

### Callback: `CommandsReceiveMessage` interface attributes
| Name          | Type                  | Description                                |
|---------------|-----------------------|--------------------------------------------|
| commandReceived | `CommandsReceiveMessage` | The command message that was received.   |
| clientId      | String                | The ID of the client that sent the command. |
| requestId     | String                | The ID of the request.                    |
| isExecuted    | boolean               | Indicates whether the command was executed. |
| timestamp     | LocalDateTime         | The timestamp of the response.            |
| error         | String                | The error message if an error occurred.   |

```typescript
async function subscribeToCommands(channelName: string) {
    //Subscribes to commands from the specified channel with a specific configuration.  
    const commandSubscriptionRequest = new CommandsSubscriptionRequest(channelName, 'group1');

    // Define the callback for receiving commandMessage  
    commandSubscriptionRequest.onReceiveEventCallback = (commandMessage: CommandMessageReceived) => {
        console.log('SubscriberA received commandMessage:', {
            id: commandMessage.id,
            fromClientId: commandMessage.fromClientId,
            timestamp: commandMessage.timestamp,
            channel: commandMessage.channel,
            metadata: commandMessage.metadata,
            body: commandMessage.body,
            tags: commandMessage.tags,
        });
    };

    // Define the callback for handling errors  
    commandSubscriptionRequest.onErrorCallback = (error: string) => {
        console.error('SubscriberA error:', error);
    };

    cqClient.subscribeToCommands(commandSubscriptionRequest)
        .then(() => {
            console.log('Command Subscription successful');
        })
        .catch((reason: any) => {
            console.error('Command Subscription failed:', reason);
        });
}
```

**Queries SubscribeToQueriesChannel Example:**

#### Request: `QueriesSubscriptionRequest` Class Attributes
| Name                    | Type                       | Description                                | Default Value | Mandatory |
|-------------------------|----------------------------|--------------------------------------------|---------------|-----------|
| channel                 | String                     | The channel for the subscription.         | None          | Yes       |
| group                   | String                     | The group associated with the subscription. | None          | No        |
| onReceiveQueriesCallback | `QueriesReceiveMessage`   | Callback function for receiving queries.  | None          | Yes       |

#### Response: `None`

### Callback: `QueriesReceiveMessage` interface attributes
| Name          | Type                     | Description                                    |
|---------------|--------------------------|------------------------------------------------|
| id            | String                   | The ID of the request.                        |
| channel       | String                   | Channel name from which the message was received. |
| metadata      | String                   | Metadata of the message.                      |
| body          | Uint8Array               | The body of the response.                     |
| tags          | Map<String, String>      | Tags associated with the query message.       |
| replyChannel  | String                   | The reply channel for this message.           |

```typescript
async function subscribeToQueries(channelName: string) {

    //Subscribes to queries from the specified channel with a specific configuration.  
    const commandSubscriptionRequest = new CommandsSubscriptionRequest(channelName, 'group1');

    // Define the callback for receiving queriesMessage  
    commandSubscriptionRequest.onReceiveEventCallback = (commandMessage: CommandMessageReceived) => {
        console.log('SubscriberA received event:', {
            id: commandMessage.id,
            fromClientId: commandMessage.fromClientId,
            timestamp: commandMessage.timestamp,
            channel: commandMessage.channel,
            metadata: commandMessage.metadata,
            body: commandMessage.body,
            tags: commandMessage.tags,
        });
    };

    // Define the callback for handling errors  
    commandSubscriptionRequest.onErrorCallback = (error: string) => {
        console.error('SubscriberA error:', error);
    };

    cqClient.subscribeToQueries(commandSubscriptionRequest)
        .then(() => {
            console.log('Queries Subscription successful');
        })
        .catch((reason: any) => {
            console.error('Queries Subscription failed:', reason);
        });
}
```
