# Building an Event-Driven Processing Pipeline

This guide walks through a multi-stage processing pipeline that combines KubeMQ events for real-time fan-out with queues for reliable, exactly-once delivery.

## Architecture

```
┌──────────┐    events     ┌─────────────┐    queue     ┌──────────┐
│ Producer │──────────────▶│  Processor  │─────────────▶│  Output  │
│ (ingest) │  (fan-out)    │  (transform)│  (reliable)  │ (persist)│
└──────────┘               └─────────────┘              └──────────┘
```

1. **Producer** publishes raw data as events on a pub/sub channel.
2. **Processor** subscribes to events, transforms each payload, and enqueues results into a queue.
3. **Output** worker pulls from the queue with ack/nack semantics to guarantee delivery.

This separation lets you scale each stage independently. Events handle real-time fan-out while queues provide backpressure and delivery guarantees.

## Prerequisites

- KubeMQ server on `localhost:50000`
- `npm install kubemq-js`

## Stage 1 — Event Producer

The producer ingests raw data and publishes it as events. Multiple subscribers can receive each event.

```typescript
import { KubeMQClient, createEventMessage, createQueueMessage } from 'kubemq-js';

async function runProducer(client: KubeMQClient): Promise<void> {
  const orders = [
    '{"id":"ORD-1","item":"widget","qty":5}',
    '{"id":"ORD-2","item":"gadget","qty":2}',
    '{"id":"ORD-3","item":"gizmo","qty":10}',
  ];

  const stream = client.createEventStream();
  stream.onError((err) => console.error('[Producer] Stream error:', err.message));

  for (const order of orders) {
    stream.send(createEventMessage({ channel: 'pipeline.ingest', body: order }));
    console.log(`[Producer] Published: ${order}`);
  }

  await new Promise((r) => setTimeout(r, 300));
  stream.close();
}
```

## Stage 2 — Event Processor

The processor subscribes to events, transforms payloads, and enqueues enriched results for reliable downstream consumption.

```typescript
function startProcessor(client: KubeMQClient) {
  const sub = client.subscribeToEvents({
    channel: 'pipeline.ingest',
    onEvent: async (event) => {
      const body = new TextDecoder().decode(event.body);
      console.log(`[Processor] Received: ${body}`);

      const enriched = JSON.stringify({
        original: JSON.parse(body),
        processed_at: new Date().toISOString(),
      });

      await client.sendQueueMessage(
        createQueueMessage({ channel: 'pipeline.output', body: enriched }),
      );
      console.log('[Processor] Enqueued for output');
    },
    onError: (err) => console.error('[Processor] Error:', err.message),
  });
  return sub;
}
```

## Stage 3 — Output Worker

The output worker pulls from the queue with exactly-once semantics. Failed messages remain on the queue for retry.

```typescript
async function runOutputWorker(client: KubeMQClient): Promise<void> {
  const messages = await client.receiveQueueMessages({
    channel: 'pipeline.output',
    maxMessages: 10,
    waitTimeoutSeconds: 5,
    visibilitySeconds: 30,
  });

  console.log(`[Output] Received ${messages.length} messages:`);
  for (const msg of messages) {
    const body = new TextDecoder().decode(msg.body);
    console.log(`  → ${body}`);
    await msg.ack();
  }
}
```

## Putting It Together

```typescript
async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'pipeline-demo',
  });

  try {
    const sub = startProcessor(client);
    await new Promise((r) => setTimeout(r, 500));

    await runProducer(client);
    await new Promise((r) => setTimeout(r, 2000));

    await runOutputWorker(client);

    sub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

## Error Handling

- **Producer failures**: Log and skip; events are fire-and-forget by design.
- **Processor failures**: If the queue send fails, the event is lost. Use events-store instead of events if you need replay capability.
- **Output failures**: Messages stay in the queue. Use dead-letter queues for messages that fail repeatedly.

## When to Use This Pattern

- Stream processing with decoupled stages
- Ingestion pipelines where throughput matters more than ordering
- Systems that need both real-time notifications and guaranteed delivery
