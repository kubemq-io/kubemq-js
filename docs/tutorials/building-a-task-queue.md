# Building a Task Queue with KubeMQ JS/TypeScript SDK

In this tutorial, you'll build a reliable task queue using KubeMQ's `KubeMQClient`. Unlike events, queued messages persist until a consumer explicitly acknowledges them — making queues ideal for work that must not be lost.

## What You'll Build

An image-processing pipeline where a producer enqueues resize jobs and a worker pulls them one at a time, processes each, and acknowledges or nacks based on the outcome.

## Prerequisites

- **Node.js 18+** installed (`node --version`)
- **KubeMQ server** running on `localhost:50000` ([quickstart guide](https://docs.kubemq.io/getting-started/quick-start))

Initialize a project and install the SDK:

```bash
mkdir image-processor && cd image-processor
npm init -y
npm install kubemq-js
npm install -D typescript tsx
```

## Step 1 — Connect to KubeMQ

The `KubeMQClient.create()` factory establishes the gRPC connection. We wrap everything in a `try/finally` to guarantee cleanup — this is the TypeScript equivalent of Java's try-with-resources.

```typescript
import { KubeMQClient, createQueueMessage } from 'kubemq-js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'image-processor',
  });

  console.log('Connected to KubeMQ server');

  const channel = 'jobs.image-resize';

  try {
```

## Step 2 — Enqueue Tasks

Each queue message has a body (the work payload) and optional key-value tags. Tags let consumers make routing decisions without deserializing the body — useful for priority handling or format-specific processing.

```typescript
const images = ['photo-001.jpg', 'photo-002.png', 'photo-003.jpg', 'INVALID_FILE', 'photo-005.jpg'];

console.log(`\n--- Enqueuing ${images.length} resize jobs ---`);

for (let i = 0; i < images.length; i++) {
  const result = await client.sendQueueMessage(
    createQueueMessage({
      channel,
      body: `resize:${images[i]}`,
      tags: {
        width: '800',
        format: 'webp',
        priority: i === 0 ? 'high' : 'normal',
      },
    }),
  );
  console.log(`  Enqueued: ${images[i]} (id=${result.messageId})`);
}
```

We include `INVALID_FILE` deliberately — this lets us demonstrate rejection handling in the next step. In real systems, workers still need to handle malformed input gracefully.

## Step 3 — Receive and Process Messages

The `receiveQueueMessages` method performs a long-poll: it waits up to `waitTimeoutSeconds` for messages to arrive, then returns an array. Each message must be explicitly acknowledged or rejected.

```typescript
console.log('\n--- Processing jobs ---');

const messages = await client.receiveQueueMessages({
  channel,
  maxMessages: 10,
  waitTimeoutSeconds: 5,
});

let processed = 0;
let failed = 0;

for (const msg of messages) {
  const body = new TextDecoder().decode(msg.body);
  const fileName = body.replace('resize:', '');
  console.log(`\n  Processing: ${fileName}`);

  if (msg.tags) {
    const tagStr = Object.entries(msg.tags)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    console.log(`    Tags: ${tagStr}`);
  }

  if (fileName.startsWith('INVALID')) {
    await msg.nack();
    console.log('    -> REJECTED (invalid file name)');
    failed++;
  } else {
    await simulateResize(fileName);
    await msg.ack();
    console.log('    -> ACKNOWLEDGED (resize complete)');
    processed++;
  }
}
```

The `ack()` / `nack()` pattern is the backbone of reliable messaging. An acknowledged message is permanently removed from the queue. A nack'd message becomes available again for redelivery — or routes to a dead-letter queue if configured.

## Step 4 — Summary and Cleanup

```typescript
    console.log('\n--- Summary ---');
    console.log(`  Processed: ${processed}`);
    console.log(`  Rejected:  ${failed}`);

    console.log('\nImage processing pipeline shut down.');
  } finally {
    await client.close();
  }
}

async function simulateResize(fileName: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

main().catch(console.error);
```

## Complete Program

```typescript
import { KubeMQClient, createQueueMessage } from 'kubemq-js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'image-processor',
  });

  console.log('Connected to KubeMQ server');

  const channel = 'jobs.image-resize';

  try {
    const images = [
      'photo-001.jpg',
      'photo-002.png',
      'photo-003.jpg',
      'INVALID_FILE',
      'photo-005.jpg',
    ];

    console.log(`\n--- Enqueuing ${images.length} resize jobs ---`);

    for (let i = 0; i < images.length; i++) {
      const result = await client.sendQueueMessage(
        createQueueMessage({
          channel,
          body: `resize:${images[i]}`,
          tags: {
            width: '800',
            format: 'webp',
            priority: i === 0 ? 'high' : 'normal',
          },
        }),
      );
      console.log(`  Enqueued: ${images[i]} (id=${result.messageId})`);
    }

    console.log('\n--- Processing jobs ---');

    const messages = await client.receiveQueueMessages({
      channel,
      maxMessages: 10,
      waitTimeoutSeconds: 5,
    });

    let processed = 0;
    let failed = 0;

    for (const msg of messages) {
      const body = new TextDecoder().decode(msg.body);
      const fileName = body.replace('resize:', '');
      console.log(`\n  Processing: ${fileName}`);

      if (msg.tags) {
        const tagStr = Object.entries(msg.tags)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        console.log(`    Tags: ${tagStr}`);
      }

      if (fileName.startsWith('INVALID')) {
        await msg.nack();
        console.log('    -> REJECTED (invalid file name)');
        failed++;
      } else {
        await simulateResize(fileName);
        await msg.ack();
        console.log('    -> ACKNOWLEDGED (resize complete)');
        processed++;
      }
    }

    console.log('\n--- Summary ---');
    console.log(`  Processed: ${processed}`);
    console.log(`  Rejected:  ${failed}`);

    console.log('\nImage processing pipeline shut down.');
  } finally {
    await client.close();
  }
}

async function simulateResize(fileName: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

main().catch(console.error);
```

Run with:

```bash
npx tsx image-processor.ts
```

## Expected Output

```
Connected to KubeMQ server

--- Enqueuing 5 resize jobs ---
  Enqueued: photo-001.jpg (id=a1b2c3d4-...)
  Enqueued: photo-002.png (id=e5f6g7h8-...)
  Enqueued: photo-003.jpg (id=i9j0k1l2-...)
  Enqueued: INVALID_FILE (id=m3n4o5p6-...)
  Enqueued: photo-005.jpg (id=q7r8s9t0-...)

--- Processing jobs ---

  Processing: photo-001.jpg
    Tags: width=800, format=webp, priority=high
    -> ACKNOWLEDGED (resize complete)

  Processing: photo-002.png
    Tags: width=800, format=webp, priority=normal
    -> ACKNOWLEDGED (resize complete)

  Processing: photo-003.jpg
    Tags: width=800, format=webp, priority=normal
    -> ACKNOWLEDGED (resize complete)

  Processing: INVALID_FILE
    Tags: width=800, format=webp, priority=normal
    -> REJECTED (invalid file name)

  Processing: photo-005.jpg
    Tags: width=800, format=webp, priority=normal
    -> ACKNOWLEDGED (resize complete)

--- Summary ---
  Processed: 4
  Rejected:  1

Image processing pipeline shut down.
```

## Error Handling

| Error                      | Cause                                  | Fix                                                            |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `Empty array returned`     | Queue is empty or timeout too short    | Increase `waitTimeoutSeconds` or verify messages were enqueued |
| `sendQueueMessage rejects` | Channel doesn't exist or server issue  | Verify server is running and channel name is correct           |
| `Message redelivered`      | Message was rejected, not acknowledged | Configure a dead-letter queue to capture repeated failures     |

For production workers, use an async polling loop:

```typescript
async function workerLoop(client: KubeMQClient, channel: string): Promise<void> {
  let emptyPolls = 0;

  while (true) {
    try {
      const messages = await client.receiveQueueMessages({
        channel,
        maxMessages: 10,
        waitTimeoutSeconds: 5,
      });

      if (messages.length === 0) {
        emptyPolls++;
        const delay = Math.min(1000 * 2 ** emptyPolls, 30000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      emptyPolls = 0;
      for (const msg of messages) {
        try {
          await processMessage(msg);
          await msg.ack();
        } catch (err) {
          console.error('Processing failed:', err);
          await msg.nack();
        }
      }
    } catch (err) {
      console.error('Poll error, retrying in 3s:', err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
```

## Next Steps

- **[Getting Started with Events](getting-started-events.md)** — fire-and-forget real-time messaging
- **[Request-Reply with Commands](request-reply-with-commands.md)** — synchronous command execution
- **Delayed Messages** — schedule tasks for future delivery
- **Dead-Letter Queues** — automatically capture messages that fail repeatedly
