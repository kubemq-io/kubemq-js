# Getting Started with Events in KubeMQ JS/TypeScript SDK

In this tutorial, you'll build a real-time event publisher and subscriber using KubeMQ's `KubeMQClient`. By the end, you'll understand how fire-and-forget messaging works in TypeScript and when to choose events over queues.

## What You'll Build

A live notification system where a publisher sends user-signup events and a subscriber processes them in real time. Events are ephemeral — subscribers only receive messages while they're connected.

## Prerequisites

- **Node.js 18+** installed (`node --version`)
- **KubeMQ server** running on `localhost:50000` ([quickstart guide](https://docs.kubemq.io/getting-started/quick-start))

Initialize a project and install the SDK:

```bash
mkdir notification-system && cd notification-system
npm init -y
npm install kubemq-js
npm install -D typescript tsx
```

## Step 1 — Connect to the KubeMQ Server

The `KubeMQClient.create()` factory establishes the gRPC connection and verifies connectivity in one step. If the server is unreachable, the promise rejects immediately rather than failing silently later.

```typescript
import { KubeMQClient, createEventMessage } from 'kubemq-js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'notification-service',
  });

  console.log('Connected to KubeMQ server');
```

## Step 2 — Subscribe to Events

Subscribers must connect *before* publishers send, because events are not persisted. This is the key difference from queues: if nobody is listening, the message is lost.

```typescript
  try {
    const channel = 'user.signups';

    const subscription = client.subscribeToEvents({
      channel,
      onMessage: (event) => {
        const body = new TextDecoder().decode(event.body);
        console.log(`[Subscriber] New signup: ${body}`);
        console.log(`  Channel: ${event.channel}`);
        if (event.tags) {
          Object.entries(event.tags).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
      },
      onError: (err) => {
        console.error('[Subscriber] Error:', err.message);
      },
    });

    console.log(`Listening for signup events on "${channel}"...`);
```

The `subscribeToEvents` method returns a subscription handle with a `cancel()` method. The `onMessage` callback fires for each incoming event on its own microtask, so your main thread stays responsive.

## Step 3 — Publish Events

With the subscriber listening, we can send events. Each event carries a string or Buffer body, optional metadata, and key-value tags for filtering.

```typescript
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newUsers = ['alice@example.com', 'bob@example.com', 'carol@example.com'];

    for (const user of newUsers) {
      await client.publishEvent(
        createEventMessage({
          channel,
          body: user,
          metadata: 'signup-service',
          tags: { source: 'registration-api', priority: 'normal' },
        }),
      );
      console.log(`[Publisher] Sent signup event for: ${user}`);
    }
```

The `createEventMessage` helper converts your string body to bytes and validates the message structure. The 1-second delay gives the subscription time to register on the server.

## Step 4 — Shut Down Gracefully

```typescript
    await new Promise((resolve) => setTimeout(resolve, 2000));

    subscription.cancel();
    console.log('\nNotification system shut down.');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

Always call `client.close()` in a `finally` block to release the gRPC connection. The `subscription.cancel()` stops the background listener before we tear down the client.

## Complete Program

```typescript
import { KubeMQClient, createEventMessage } from 'kubemq-js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'notification-service',
  });

  console.log('Connected to KubeMQ server');

  try {
    const channel = 'user.signups';

    const subscription = client.subscribeToEvents({
      channel,
      onMessage: (event) => {
        const body = new TextDecoder().decode(event.body);
        console.log(`[Subscriber] New signup: ${body}`);
        console.log(`  Channel: ${event.channel}`);
        if (event.tags) {
          Object.entries(event.tags).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
      },
      onError: (err) => {
        console.error('[Subscriber] Error:', err.message);
      },
    });

    console.log(`Listening for signup events on "${channel}"...`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newUsers = ['alice@example.com', 'bob@example.com', 'carol@example.com'];

    for (const user of newUsers) {
      await client.publishEvent(
        createEventMessage({
          channel,
          body: user,
          metadata: 'signup-service',
          tags: { source: 'registration-api', priority: 'normal' },
        }),
      );
      console.log(`[Publisher] Sent signup event for: ${user}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    subscription.cancel();
    console.log('\nNotification system shut down.');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

Run with:

```bash
npx tsx notification-system.ts
```

## Expected Output

```
Connected to KubeMQ server
Listening for signup events on "user.signups"...
[Publisher] Sent signup event for: alice@example.com
[Publisher] Sent signup event for: bob@example.com
[Publisher] Sent signup event for: carol@example.com
[Subscriber] New signup: alice@example.com
  Channel: user.signups
  source: registration-api
  priority: normal
[Subscriber] New signup: bob@example.com
  Channel: user.signups
  source: registration-api
  priority: normal
[Subscriber] New signup: carol@example.com
  Channel: user.signups
  source: registration-api
  priority: normal

Notification system shut down.
```

## Error Handling

Common issues and how to handle them:

| Error | Cause | Fix |
|-------|-------|-----|
| `Connection refused` | KubeMQ server not running | Start the server: `docker run -p 50000:50000 kubemq/kubemq` |
| `Subscriber missed events` | Subscriber connected after publisher sent | Always subscribe before publishing |
| `ConnectionError` | Network interruption | Catch and reconnect with `KubeMQClient.create()` |

For production, wrap your subscriber in a resilient pattern:

```typescript
async function resilientSubscribe(client: KubeMQClient, channel: string): Promise<void> {
  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    try {
      const sub = client.subscribeToEvents({
        channel,
        onMessage: (event) => processEvent(event),
        onError: (err) => {
          console.error('Subscription error, will retry:', err.message);
          retries++;
        },
      });
      return;
    } catch (err) {
      retries++;
      const delay = Math.min(1000 * 2 ** retries, 30000);
      console.log(`Retry ${retries}/${maxRetries} in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
```

## Next Steps

- **[Building a Task Queue](building-a-task-queue.md)** — guaranteed delivery with acknowledgment
- **[Request-Reply with Commands](request-reply-with-commands.md)** — synchronous command execution
- **Events Store** — persistent events with replay from any point in time
- **Consumer Groups** — load-balance events across multiple subscribers
