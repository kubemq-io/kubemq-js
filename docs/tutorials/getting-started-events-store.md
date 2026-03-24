# Getting Started with Events Store in KubeMQ JS/TypeScript SDK

In this tutorial, you'll build a persistent event publisher and subscriber using KubeMQ's `KubeMQClient` and Events Store. By the end, you'll understand how stored events differ from ephemeral events and when to use them for replay and audit trails.

## What You'll Build

A user-activity log where events are persisted in the store. Subscribers can connect _after_ events are published and still receive them — unlike regular events, which are lost if nobody is listening.

## Prerequisites

- **Node.js 18+** installed (`node --version`)
- **KubeMQ server** running on `localhost:50000` ([quickstart guide](https://docs.kubemq.io/getting-started/quick-start))

Initialize a project and install the SDK:

```bash
mkdir activity-logger && cd activity-logger
npm init -y
npm install kubemq-js
npm install -D typescript tsx
```

## Step 1 — Connect to the KubeMQ Server

The `KubeMQClient.create()` factory establishes the gRPC connection and verifies connectivity. Events Store uses the same client as regular events.

```typescript
import { KubeMQClient, createEventStoreMessage, EventStoreStartPosition } from 'kubemq-js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-store-persistent-pubsub-client',
  });

  console.log('Connected to KubeMQ server');
```

## Step 2 — Subscribe to Stored Events

Subscribe with `EventStoreStartPosition.StartFromNew` to receive only events published after the subscription starts. Use `StartFromFirst` to replay all stored events, or `StartFromLast` for only new ones.

```typescript
  try {
    const channel = 'user.activity';

    const subscription = client.subscribeToEventsStore({
      channel,
      startFrom: EventStoreStartPosition.StartFromNew,
      onEvent: (event) => {
        console.log(`Received [seq=${event.sequence}]:`, new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Subscription error:', err.message);
      },
    });

    console.log(`Listening for stored events on "${channel}"...`);
```

The `subscribeToEventsStore` method returns a subscription handle with a `cancel()` method. With `StartFromNew`, you receive events published after the subscription; with `StartFromFirst`, you replay everything in the store.

## Step 3 — Publish Events to the Store

Events Store persists messages before delivery. With the subscriber connected, send events — they are stored and delivered to active subscribers.

```typescript
await new Promise((resolve) => setTimeout(resolve, 500));

for (let i = 1; i <= 3; i++) {
  await client.sendEventStore(
    createEventStoreMessage({
      channel,
      body: `User action #${i}: login from 192.168.1.${i}`,
      tags: { action: 'login', sequence: String(i) },
    }),
  );
  console.log(`Published event #${i}`);
}
```

The `createEventStoreMessage` helper builds a valid event store message with channel, body, and optional tags.

## Step 4 — Shut Down Gracefully

```typescript
    await new Promise((resolve) => setTimeout(resolve, 2000));

    subscription.cancel();
    console.log('\nActivity logger shut down.');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

Always call `client.close()` in a `finally` block to release the gRPC connection.

## Complete Program

```typescript
import { KubeMQClient, createEventStoreMessage, EventStoreStartPosition } from 'kubemq-js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-store-persistent-pubsub-client',
  });

  console.log('Connected to KubeMQ server');

  try {
    const channel = 'user.activity';

    const subscription = client.subscribeToEventsStore({
      channel,
      startFrom: EventStoreStartPosition.StartFromNew,
      onEvent: (event) => {
        console.log(`Received [seq=${event.sequence}]:`, new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Subscription error:', err.message);
      },
    });

    console.log(`Listening for stored events on "${channel}"...`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    for (let i = 1; i <= 3; i++) {
      await client.sendEventStore(
        createEventStoreMessage({
          channel,
          body: `User action #${i}: login from 192.168.1.${i}`,
          tags: { action: 'login', sequence: String(i) },
        }),
      );
      console.log(`Published event #${i}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    subscription.cancel();
    console.log('\nActivity logger shut down.');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

Run with:

```bash
npx tsx activity-logger.ts
```

## Expected Output

```
Connected to KubeMQ server
Listening for stored events on "user.activity"...
Published event #1
Published event #2
Published event #3
Received [seq=<sequence>]: User action #1: login from 192.168.1.1
Received [seq=<sequence>]: User action #2: login from 192.168.1.2
Received [seq=<sequence>]: User action #3: login from 192.168.1.3

Activity logger shut down.
```

## Events Store vs Regular Events

| Feature           | Events                           | Events Store                                |
| ----------------- | -------------------------------- | ------------------------------------------- |
| Persistence       | Ephemeral                        | Stored                                      |
| Replay            | No                               | Yes (StartFromFirst, StartAtSequence, etc.) |
| Subscriber timing | Must be connected before publish | Can connect after publish                   |
| Use case          | Real-time notifications          | Audit logs, replay, late joiners            |

## Next Steps

- **[Getting Started with Events](getting-started-events.md)** — ephemeral fire-and-forget messaging
- **[Building a Task Queue](building-a-task-queue.md)** — guaranteed delivery with acknowledgment
- **Consumer Groups** — load-balance events store across multiple subscribers
