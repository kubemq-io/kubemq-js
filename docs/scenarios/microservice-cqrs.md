# Implementing CQRS with KubeMQ

This guide demonstrates a Command Query Responsibility Segregation (CQRS) architecture using KubeMQ's native messaging primitives: commands for writes, queries for reads, and events for state synchronization.

## Architecture

```
┌────────┐  command   ┌──────────────┐  event   ┌──────────────┐
│ Client │───────────▶│ Write Service │────────▶│ Read Service │
│        │            │ (cmd handler) │          │ (projection) │
│        │◀───────────│              │          │              │
│        │  query     └──────────────┘          └──────────────┘
│        │────────────────────────────────────▶│              │
│        │◀───────────────────────────────────│              │
└────────┘                                     └──────────────┘
```

1. **Commands** carry write intent — "create order", "update status". The write service processes commands and emits domain events.
2. **Events** propagate state changes to read-side projections asynchronously.
3. **Queries** retrieve data from the read-optimized projection, independent of the write model.

## Prerequisites

- KubeMQ server on `localhost:50000`
- `npm install kubemq-js`

## Write Service — Command Handler

The write service subscribes to commands, validates them, applies business logic, and publishes domain events.

```typescript
import {
  KubeMQClient,
  createCommand,
  createQuery,
  createEventMessage,
} from 'kubemq-js';

const store = new Map<string, string>();

function startWriteService(client: KubeMQClient) {
  const eventStream = client.createEventStream();
  eventStream.onError((err) => console.error('[Write] Event stream error:', err.message));

  const sub = client.subscribeToCommands({
    channel: 'cqrs.commands',
    onCommand: async (cmd) => {
      const body = new TextDecoder().decode(cmd.body);
      const orderId = cmd.tags?.order_id ?? 'unknown';
      console.log(`[Write] Command: ${body}`);

      store.set(orderId, body);

      await client.sendCommandResponse({
        id: cmd.id,
        replyChannel: cmd.replyChannel,
        executed: true,
      });

      eventStream.send(
        createEventMessage({
          channel: 'cqrs.events',
          body,
          metadata: orderId,
        }),
      );
      console.log(`[Write] Order ${orderId} persisted, event emitted`);
    },
    onError: (err) => console.error('[Write] Error:', err.message),
  });

  return { sub, eventStream };
}
```

## Read Service — Query Handler with Event Projection

The read service maintains a denormalized projection updated by domain events, and serves queries against it.

```typescript
const projection = new Map<string, string>();

function startReadService(client: KubeMQClient) {
  const eventSub = client.subscribeToEvents({
    channel: 'cqrs.events',
    onEvent: (event) => {
      const key = event.metadata ?? '';
      const body = new TextDecoder().decode(event.body);
      projection.set(key, body);
      console.log(`[Read] Projection updated: key=${key}`);
    },
    onError: (err) => console.error('[Read] Event error:', err.message),
  });

  const querySub = client.subscribeToQueries({
    channel: 'cqrs.queries',
    onQuery: async (q) => {
      const key = new TextDecoder().decode(q.body);
      const data = projection.get(key) ?? '';
      const found = projection.has(key);

      const result = JSON.stringify({ found, data });

      await client.sendQueryResponse({
        id: q.id,
        replyChannel: q.replyChannel,
        executed: true,
        body: new TextEncoder().encode(result),
      });
      console.log(`[Read] Query served: key=${key} found=${found}`);
    },
    onError: (err) => console.error('[Read] Query error:', err.message),
  });

  return { eventSub, querySub };
}
```

## Client — Sending Commands and Queries

```typescript
async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'cqrs-demo',
  });

  try {
    const write = startWriteService(client);
    const read = startReadService(client);
    await new Promise((r) => setTimeout(r, 1000));

    // Write via command
    const cmdResp = await client.sendCommand(
      createCommand({
        channel: 'cqrs.commands',
        body: JSON.stringify({ item: 'widget', qty: 5 }),
        tags: { order_id: 'ORD-001' },
        timeoutMs: 10000,
      }),
    );
    console.log(`[Client] Command executed: ${cmdResp.executed}`);

    await new Promise((r) => setTimeout(r, 500));

    // Read via query
    const queryResp = await client.sendQuery(
      createQuery({
        channel: 'cqrs.queries',
        body: 'ORD-001',
        timeoutMs: 10000,
      }),
    );
    if (queryResp.body) {
      const data = new TextDecoder().decode(queryResp.body);
      console.log(`[Client] Query result: ${data}`);
    }

    write.sub.cancel();
    write.eventStream.close();
    read.eventSub.cancel();
    read.querySub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

## Design Considerations

| Concern | Approach |
|---|---|
| **Consistency** | Eventually consistent — events propagate asynchronously to the read model |
| **Ordering** | Use events-store with sequence replay if strict ordering matters |
| **Durability** | Commands are request-reply; the write service persists before acking |
| **Scaling** | Read and write services scale independently via consumer groups |
| **Failure** | If the read service misses events, replay from events-store |

## When to Use This Pattern

- Systems where read and write workloads have different scaling requirements
- Domain models that benefit from separate write validation and read optimization
- Microservices that need event-driven state synchronization across bounded contexts
