# KubeMQ Node JS/TS SDK

The **KubeMQ SDK for NodeJS/TS** enables typescript developers to communicate with [KubeMQ](https://kubemq.io/) server.

<!-- TOC -->
* [KubeMQ Node JS/TS SDK](#kubemq-node-jsts-sdk)
  * [Prerequisites](#prerequisites)
  * [General SDK description](#general-sdk-description)
    * [Installing](#installing)
  * [Running the examples](#running-the-examples)
  * [Building from source](#building-from-source)
  * [Payload Details](#payload-details)
* [KubeMQ PubSub Client Examples](#kubemq-pubsub-client-examples)
  * [File Structure](#file-structure)
      * [Event](#event)
  * [Getting Started](#getting-started)
    * [Construct the PubsubClient](#construct-the-pubsubclient)
    * [PubsubClient Accepted Configuration](#pubsubclient-accepted-configuration)
    * [PubsubClient connection establishment example code](#pubsubclient-connection-establishment-example-code)
* [KubeMQ Queues Client Examples](#kubemq-queues-client-examples)
  * [Project Structure](#project-structure)
  * [Getting Started](#getting-started-1)
    * [Construct the QueuesClient](#construct-the-queuesclient)
    * [QueuesClient Accepted Configuration](#queuesclient-accepted-configuration)
    * [QueuesClient establishing connection example code](#queuesclient-establishing-connection-example-code)
      
* [KubeMQ Command & Query Client Examples](#kubemq-command--query-client-examples)
  * [Project Structure](#project-structure-1)
      * [Command](#command)
  * [Getting Started](#getting-started-2)
    * [Construct the CQClient](#construct-the-cqclient)
    * [CQClient Accepted Configuration](#cqclient-accepted-configuration)
    * [CQClient establishing connection example code](#cqclient-establishing-connection-example-code)
  * [Support](#support)
<!-- TOC -->
## Prerequisites

- Node.js (Ensure you have a recent version of Node.js installed)

- TypeScript Compiler

- KubeMQ server running locally or accessible over the network


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

npx  path/to/example_file.ts

Example:

npx  tsc  examples/cq/CreateExample.ts

```

Above command will compile the .ts file and produce the .js file in same directory where .ts file is, To run the compiled JavaScript file use below command .

```bash

node  path/to/example_file.js

Example:

node  examples/cq/CreateExample.ts

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

-  `pubsub\CreateChannelExample.ts`: Demonstrates creating event channels.

-  `pubsub\DeleteChannelExample.ts`: Demonstrates deleting event channels.

-  `pubsub\ListEventsChanneExample.ts`: Demonstrates listing event channels.

-  `pubsub\SendEventMessageExample.ts`: Demonstrates to send message to single event & event-store event channel

-  `pubsub\SubscribeToEventExample.ts`: Demonstrates Subscribe to event channel

-  `pubsub\SubscribeToEventStoreExample.ts` Demonstrates example of subscribing event-store channel.


## Getting Started

### Construct the PubsubClient

For executing PubSub operation we have to create the instance of PubsubClient, it's instance can created with minimum two parameter `address` (KubeMQ server address) & `clientId` . With these two parameter plainText connection are established. Below Table Describe the Parameters available for establishing connection.

### PubsubClient Accepted Configuration

| Name                     | Type    | Description                                                | Default Value        | Mandatory |
|--------------------------|---------|------------------------------------------------------------|----------------------|-----------|
| address                  | String  | The address of the KubeMQ server.                         | None                 | Yes       |
| clientId                 | String  | The client ID used for authentication.                     | None                 | Yes       |
| authToken                | String  | The authorization token for secure communication.          | None                 | No        |
| tls                      | boolean | Indicates if TLS (Transport Layer Security) is enabled.    | None                 | No        |
| tlsCertFile              | String  | The path to the TLS certificate file.                      | None                 | No (Yes if `tls` is true) |
| tlsKeyFile               | String  | The path to the TLS key file.                              | None                 | No (Yes if `tls` is true) |
| maxReceiveSize           | int     | The maximum size of the messages to receive (in bytes).    | 104857600 (100MB)    | No        |
| reconnectIntervalSeconds | int     | The interval in seconds between reconnection attempts.     | 5                    | No        |
| keepAlive                | boolean | Indicates if the connection should be kept alive.         | None                 | No        |
| pingIntervalInSeconds    | int     | The interval in seconds between ping messages.            | None                 | No        |
| pingTimeoutInSeconds     | int     | The timeout in seconds for ping messages.                 | None                 | No        |

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
	credentials: {
	cert:  Buffer.from('your-cert-content'), // Optional client cert credentials for talking to KubeMQ
	key:  Buffer.from('your-key-content'),
	caCert:  Buffer.from('your-ca-cert-content') // Optional CA certificate
}

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

**PubSub CreateEventsChannel Example:**

#### Request:

| Name        | Type   | Description                                 | Default Value | Mandatory |
|-------------|--------|---------------------------------------------|---------------|-----------|
| channelName | String | Channel name which you want to subscribe to | None          | Yes       |


#### Response:

| Name | Type          | Description                           |
|------|---------------|---------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |

```typescript

async  function  createEventsChannel(channel: string) {
return  pubsubClient.createEventsChannel(channel);
}

```

**PubSub Create Events Store Channel Example:**

#### Request:

| Name        | Type   | Description                                 | Default Value | Mandatory |
|-------------|--------|---------------------------------------------|---------------|-----------|
| channelName | String | Channel name to which you want to subscribe | None          | Yes       |


#### Response:

| Name | Type          | Description                            |
|------|---------------|----------------------------------------|
| void | Promise<void> | Doesn't return a value upon completion |


----------------------------------------------------------------------------

```typescript

async  function  createEventsStoreChannel(channel: string) {
return  pubsubClient.createEventsStoreChannel(channel);
}

```

**PubSub ListEventsChannel Example:**

#### Request:

| Name        | Type   | Description                               | Default Value | Mandatory |
|-------------|--------|-------------------------------------------|---------------|-----------|
| channelName | String | Channel name that you want to search for  | None          | No        |


#### Response: `PubSubChannel[]`  `PubSubChannel` interface Attributes

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

#### Request:

| Name        | Type   | Description                               | Default Value | Mandatory |
|-------------|--------|-------------------------------------------|---------------|-----------|
| channelName | String | Channel name that you want to search for  | None          | No        |

#### Response: `PubSubChannel[]`  `PubSubChannel` interface Attributes

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

**PubSub SendEventMessage Example:**

#### Request: `EventMessage` Interface Attributes


| Name     | Type                  | Description                                              | Default Value    | Mandatory |
|----------|-----------------------|----------------------------------------------------------|------------------|-----------|
| id       | String                | Unique identifier for the event message.                | None             | No        |
| channel  | String                | The channel to which the event message is sent.         | None             | Yes       |
| metadata | String                | Metadata associated with the event message.             | None             | No        |
| body     | byte[]                | Body of the event message in bytes.                     | Empty byte array | No        |
| tags     | Map<String, String>   | Tags associated with the event message as key-value pairs. | Empty Map       | No        |


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

| Name     | Type                  | Description                                              | Default Value    | Mandatory |
|----------|-----------------------|----------------------------------------------------------|------------------|-----------|
| id       | String                | Unique identifier for the event message.                | None             | No        |
| channel  | String                | The channel to which the event message is sent.         | None             | Yes       |
| metadata | String                | Metadata associated with the event message.             | None             | No        |
| body     | byte[]                | Body of the event message in bytes.                     | Empty byte array | No        |
| tags     | Map<String, String>   | Tags associated with the event message as key-value pairs. | Empty Map       | No        |


**Note:-**  `metadata` or `body` or `tags` any one is required

#### Response: `NONE`

```typescript

await  pubsubClient.sendEventStoreMessage({
	id:  '987',
	channel: 'events_store.single',
	body:  Utils.stringToBytes('event store message'),
});

```

**PubSub SubscribeEvents Example:**

#### Request: `EventsSubscription` Class Attributes


| Name                    | Type                               | Description                                                               | Default Value | Mandatory |
|-------------------------|------------------------------------|---------------------------------------------------------------------------|---------------|-----------|
| channel                 | String                             | The channel to subscribe to.                                                | None          | Yes       |
| group                   | String                             | The group to subscribe with.                                                | None          | No        |
| onReceiveEventCallback   | Consumer<EventMessageReceived>    | Callback function to be called when an event message is received.          | None          | Yes       |
| onErrorCallback         | Consumer<String>                   | Callback function to be called when an error occurs.                       | None          | No        |


#### Response: `NONE`

#### Callback: `EventMessageReceived` class details

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

#### Request: `EventsStoreSubscription` Interface Attributes


| Name                     | Type                                    | Description                                                             | Default Value | Mandatory |
|--------------------------|-----------------------------------------|-------------------------------------------------------------------------|---------------|-----------|
| channel                  | String                                  | The channel to subscribe to.                                             | None          | Yes       |
| group                    | String                                  | The group to subscribe with.                                             | None          | No        |
| onReceiveEventCallback    | Consumer<EventStoreMessageReceived>    | Callback function to be called when an event message is received.       | None          | Yes       |
| onErrorCallback          | Consumer<String>                       | Callback function to be called when an error occurs.                    | None          | No        |

#### Response: `None`

#### Callback: `EventStoreMessageReceived` class details

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
      console.log('Eventstore Subscription successful');  
    })  
    .catch((reason: any) => {  
      console.error('Eventstore Subscription failed:', reason);  
    });  
}
```

**PubSub DeleteEventsChannel Example:**



#### Request:

| Name        | Type   | Description                                   | Default Value | Mandatory |
|-------------|--------|-----------------------------------------------|---------------|-----------|
| channelName | String | Channel name that you want to delete         | None          | Yes       |

#### Response:

| Name | Type          | Description    |
|------|---------------|----------------|
| void | Promise<void> | Returns nothing |


----------------------------------------------------------------------------

```typescript

async  function  deleteChannel(channel: string) {
	return  pubsubClient.deleteEventsChannel(channel);
}

```

**PubSub DeleteEventsStoreChannel Example:**

#### Request:

| Name        | Type   | Description                               | Default Value | Mandatory |
|-------------|--------|-------------------------------------------|---------------|-----------|
| channelName | String | The name of the channel you want to delete | None          | Yes       |


#### Response:

| Name             | Type    | Description                   |
|------------------|---------|-------------------------------|
| isChannelDeleted | boolean | Indicates if the channel is deleted (true/false) |


----------------------------------------------------------------------------



```typescript

async  function  deleteChannel(channel: string) {
	return  pubsubClient.deleteEventsStoreChannel(channel);
}

```


# KubeMQ Queues Client Examples

Below examples demonstrating the usage of KubeMQ Queues client. The examples include creating, deleting, listing channels, and sending/receiving queues messages.

## Project Structure

-  `queues/CreateQueuesChannelExample.ts`: Demonstrates creating queues channels.

-  `queues/DeleteQueuesChannelExample.ts`: Demonstrates deleting queues channels.

-  `queues/ListQueuesChannelExample.ts`: Demonstrates listing queues channels.

-  `queues/Send_ReceiveMessageExample.ts`: Demonstrates example of sending & receiving message.

-  `queues/WaitingPullExample.ts`: Demonstrates example of pulling message by waiting and pulling.


## Getting Started

### Construct the QueuesClient

For executing Queues operation we have to create the instance of QueuesClient, it's instance can created with minimum two parameter `address` (KubeMQ server address) & `clientId` . With these two parameter plainText connection are established. Below Table Describe the Parameters available for establishing connection.

### QueuesClient Accepted Configuration

| Name                     | Type    | Description                                                | Default Value        | Mandatory |
|--------------------------|---------|------------------------------------------------------------|----------------------|-----------|
| address                  | String  | The address of the KubeMQ server.                         | None                 | Yes       |
| clientId                 | String  | The client ID used for authentication.                     | None                 | Yes       |
| authToken                | String  | The authorization token for secure communication.          | None                 | No        |
| tls                      | boolean | Indicates if TLS (Transport Layer Security) is enabled.    | None                 | No        |
| tlsCertFile              | String  | The path to the TLS certificate file.                      | None                 | No (Yes if `tls` is true) |
| tlsKeyFile               | String  | The path to the TLS key file.                              | None                 | No (Yes if `tls` is true) |
| maxReceiveSize           | int     | The maximum size of the messages to receive (in bytes).    | 104857600 (100MB)    | No        |
| reconnectIntervalSeconds | int     | The interval in seconds between reconnection attempts.     | 5                    | No        |
| keepAlive                | boolean | Indicates if the connection should be kept alive.         | None                 | No        |
| pingIntervalInSeconds    | int     | The interval in seconds between ping messages.            | None                 | No        |
| pingTimeoutInSeconds     | int     | The timeout in seconds for ping messages.                 | None                 | No        |



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


| Name             | Type  | Description                                          |
|------------------|-------|------------------------------------------------------|
| host             | String| The host of the server.                            |
| version          | String| The version of the server.                         |
| serverStartTime  | long  | The start time of the server (in seconds).         |
| serverUpTimeSeconds | long  | The uptime of the server (in seconds).             |

```typescript

ServerInfo  pingResult = queuesClient.ping();
console.log('Ping Response: ' + pingResult);

```

**Queues CreateQueueChannel Example:**

#### Request:
| Name         | Type   | Description                              | Default Value | Mandatory |
|--------------|--------|------------------------------------------|---------------|-----------|
| channelName  | String | The name of the channel you want to create | None          | Yes       |


#### Response:

| Name             | Type    | Description                                    |
|------------------|---------|------------------------------------------------|
| isChannelCreated | boolean | Indicates whether the channel was created (true/false) |

----------------------------------------------------------------------------

```typescript

async  function  createQueueChannel(channel: string) {
	return  queuesClient.createQueuesChannel(channel);
}

```

**Queues listQueueChannels Example:**

#### Request:

| Name          | Type   | Description                              | Default Value | Mandatory |
|---------------|--------|------------------------------------------|---------------|-----------|
| searchString  | String | The channel name you want to search for | None          | No        |


#### Response: `QueuesChannel[]` QueuesChannel interface Attributes

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



**Queues SendSingleMessage Example:**

#### Request: `QueueMessage` class attributes

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


#### Response: `QueueSendResult` class attributes

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

#### Request: `QueuesPullWaitngMessagesRequest` class attributes

| Name                | Type   | Description                                | Default Value | Mandatory |
|---------------------|--------|--------------------------------------------|---------------|-----------|
| channel             | String | The channel to poll messages from.         | None          | Yes       |
| maxNumberOfMessages | int    | The maximum number of messages to poll.    | 1             | No        |
| waitTimeoutSeconds  | int    | The wait timeout in seconds for polling messages. | 60        | No        |



#### Response: `QueuesPullWaitingMessagesResponse` class attributes
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

#### Request: `QueuesPullWaitngMessagesRequest` class attributes
| Name               | Type   | Description                                        | Default Value | Mandatory |
|--------------------|--------|----------------------------------------------------|---------------|-----------|
| channel            | String | The channel to poll messages from.                 | None          | Yes       |
| maxNumberOfMessages| int    | The maximum number of messages to poll.            | 1             | No        |
| waitTimeoutSeconds | int    | The wait timeout in seconds for polling messages.  | 60            | No        |


#### Response: `QueuesPullWaitingMessagesResponse` class attributes

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


# KubeMQ Command & Query Client Examples

Below examples demonstrating the usage of KubeMQ CQ (Commands and Queries) Client. The examples include creating, deleting, listing channels, and sending/subscribing to command and query messages.

## Project Structure

#### Command

-  `cq\CreateExample.ts`: Demonstrates creating command channels.
-  `cq\DeleteExample.ts`: Demonstrates deleting command channels.
-  `cq\ListExample.ts`: Demonstrates listing command channels.
-  `cq\CommandsExample.ts`: Demonstrates sending to command messages.
- `cq\SubscribeCommandsExample.ts`: Demonstrates subscribing to command messages.
-  `cq\QueriesExample.ts`: Demonstrates sending to queries messages.
-  `cq\SubscribeQueriesExample.ts`: Demonstrates subscribing to queries messages.

## Getting Started

### Construct the CQClient

For executing command & query operation we have to create the instance of CQClient, it's instance can created with minimum two parameter `address` (KubeMQ server address) & `clientId` . With these two parameter plainText connection are established. Below Table Describe the Parameters available for establishing connection.

### CQClient Accepted Configuration

| Name                     | Type    | Description                                                | Default Value        | Mandatory |
|--------------------------|---------|------------------------------------------------------------|----------------------|-----------|
| address                  | String  | The address of the KubeMQ server.                         | None                 | Yes       |
| clientId                 | String  | The client ID used for authentication.                     | None                 | Yes       |
| authToken                | String  | The authorization token for secure communication.          | None                 | No        |
| tls                      | boolean | Indicates if TLS (Transport Layer Security) is enabled.    | None                 | No        |
| tlsCertFile              | String  | The path to the TLS certificate file.                      | None                 | No (Yes if `tls` is true) |
| tlsKeyFile               | String  | The path to the TLS key file.                              | None                 | No (Yes if `tls` is true) |
| maxReceiveSize           | int     | The maximum size of the messages to receive (in bytes).    | 104857600 (100MB)    | No        |
| reconnectIntervalSeconds | int     | The interval in seconds between reconnection attempts.     | 5                    | No        |
| keepAlive                | boolean | Indicates if the connection should be kept alive.         | None                 | No        |
| pingIntervalInSeconds    | int     | The interval in seconds between ping messages.            | None                 | No        |
| pingTimeoutInSeconds     | int     | The timeout in seconds for ping messages.                 | None                 | No        |


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

| Name              | Type   | Description                                  |
|-------------------|--------|----------------------------------------------|
| host              | String | The host of the server.                      |
| version           | String | The version of the server.                   |
| serverStartTime   | long   | The start time of the server (in seconds).   |
| serverUpTimeSeconds | long   | The uptime of the server (in seconds).       |

```typescript

ServerInfo  pingResult = cqClient.ping();
console.log('Ping Response: ' + pingResult);

```

**Command CreateCommandsChannel Example:**

#### Request:

| Name        | Type   | Description                         | Default Value | Mandatory |
|-------------|--------|-------------------------------------|---------------|-----------|
| channelName | String | Channel name which you want to create | None          | Yes       |


#### Response:

| Name              | Type    | Description                        |
|-------------------|---------|------------------------------------|
| isChannelCreated  | boolean | Indicates if the channel was created (true/false) |

----------------------------------------------------------------------------

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

| Name              | Type    | Description                              |
|-------------------|---------|------------------------------------------|
| isChannelCreated  | boolean | Indicates whether the channel was created (true/false) |


----------------------------------------------------------------------------

```typescript

async  function  createQueriesChannel(channel: string) {
	return  cqClient.createQueriesChannel(channel);
}

```

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

**Command SubscribeToCommandsChannel Example:**

#### Request: `CommandsSubscription` Class Attributes
| Name                     | Type                    | Description                                      | Default Value | Mandatory |
|--------------------------|-------------------------|--------------------------------------------------|---------------|-----------|
| channel                  | String                  | The channel for the subscription.               | None          | Yes       |
| group                    | String                  | The group associated with the subscription.     | None          | No        |
| onReceiveCommandCallback | `CommandsReceiveMessage`| Callback function for receiving commands.       | None          | Yes       |


#### Response: `None`

#### Callback: `CommandsReceiveMessage` interface attributes
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

#### Callback: `QueriesReceiveMessage` interface attributes
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


**Command DeleteCommandsChannel Example:**

#### Request:


| Name         | Type   | Description                                | Default Value | Mandatory |
|--------------|--------|--------------------------------------------|---------------|-----------|
| channelName  | String | The name of the channel you want to delete. | None          | Yes       |


#### Response:

| Name  | Type         | Description                           |
|-------|--------------|---------------------------------------|
| void  | Promise<void> | Indicates no result is returned after deletion. |

----------------------------------------------------------------------------

```typescript

async  function  deleteCommandsChannel(channel: string) {
	return  cqClient.deleteCommandsChannel(channel);
}

```

**Queries DeleteQueriesChannel Example:**

#### Request:
| Name         | Type   | Description                          | Default Value | Mandatory |
|--------------|--------|--------------------------------------|---------------|-----------|
| channelName  | String | Channel name which you want to delete | None          | Yes       |


#### Response:
| Name | Type         | Description                      |
|------|--------------|----------------------------------|
| void | Promise<void> | Channel deletion returns no result |

----------------------------------------------------------------------------

```typescript

async  function  deleteQueriesChannel(channel: string) {
	return  cqClient.deleteQueriesChannel(channel);
}

```

## Support

if you encounter any issues, please open an issue here,

In addition, you can reach us for support by:

- [**Email**](mailto://support@kubemq.io)

- [**Slack**](https://join.slack.com/t/kubemq/shared_invite/enQtNDk3NjE1Mjg1MDMwLThjMGFmYjU1NTVhZWRjZTRjYTIxM2E5MjA5ZDFkMWUyODI3YTlkOWY2MmYzNGIwZjY3OThlMzYxYjYwMTVmYWM)