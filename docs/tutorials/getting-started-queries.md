# Getting Started with Queries in KubeMQ JS/TypeScript SDK

In this tutorial, you'll build a request-reply system using KubeMQ's `KubeMQClient` and queries. By the end, you'll understand how to send queries, handle them with a responder, and receive data responses synchronously.

## What You'll Build

An inventory lookup service where a client sends a query (e.g., SKU and warehouse) and a handler responds with structured data. Queries are request-reply with a data payload — ideal for read operations and lookups.

## Prerequisites

- **Node.js 18+** installed (`node --version`)
- **KubeMQ server** running on `localhost:50000` ([quickstart guide](https://docs.kubemq.io/getting-started/quick-start))

Initialize a project and install the SDK:

```bash
mkdir inventory-service && cd inventory-service
npm init -y
npm install kubemq-js
npm install -D typescript tsx
```

## Step 1 — Connect to the KubeMQ Server

The `KubeMQClient.create()` factory establishes the gRPC connection. The same client handles both sending queries and receiving them.

```typescript
import { KubeMQClient, createQuery } from 'kubemq-js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-rpc-send-query-client',
  });

  console.log('Connected to KubeMQ server');
```

## Step 2 — Subscribe to Handle Incoming Queries

Register a handler with `subscribeToQueries`. The `onQuery` callback receives each query; use `sendQueryResponse` to reply with data.

```typescript
  try {
    const channel = 'inventory.lookup';

    const subscription = client.subscribeToQueries({
      channel,
      onQuery: async (query) => {
        console.log('Received query:', query.id);
        const request = JSON.parse(new TextDecoder().decode(query.body));
        const item = inventory[request.sku];

        if (item) {
          await client.sendQueryResponse({
            id: query.id,
            replyChannel: query.replyChannel,
            executed: true,
            body: new TextEncoder().encode(
              JSON.stringify({
                sku: request.sku,
                ...item,
                warehouse: request.warehouse,
              }),
            ),
          });
          console.log('  Responded with inventory data for', request.sku);
        } else {
          await client.sendQueryResponse({
            id: query.id,
            replyChannel: query.replyChannel,
            executed: false,
            error: `SKU not found: ${request.sku}`,
          });
          console.log('  SKU not found:', request.sku);
        }
      },
      onError: (err) => {
        console.error('Subscription error:', err.message);
      },
    });

    console.log(`Listening for queries on "${channel}"...`);
```

The handler must call `sendQueryResponse` with the query's `id` and `replyChannel` so the sender receives the reply.

## Step 3 — Send a Query and Wait for the Response

Build a query with `createQuery` and send it with `sendQuery`. The method returns a promise that resolves when the response arrives or rejects on timeout.

```typescript
await new Promise((resolve) => setTimeout(resolve, 500));

const response = await client.sendQuery(
  createQuery({
    channel,
    body: JSON.stringify({ sku: 'WIDGET-42', warehouse: 'east' }),
    timeoutInSeconds: 10,
  }),
);

if (response.executed && response.body) {
  const data = JSON.parse(new TextDecoder().decode(response.body));
  console.log('Inventory response:', data);
} else {
  console.error('Query failed:', response.error);
}
```

## Step 4 — Shut Down Gracefully

```typescript
    subscription.cancel();
    console.log('\nInventory service shut down.');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

## Complete Program

```typescript
import { KubeMQClient, createQuery } from 'kubemq-js';

const inventory: Record<string, { inStock: number; price: number }> = {
  'WIDGET-42': { inStock: 150, price: 12.99 },
  'GADGET-7': { inStock: 0, price: 24.5 },
  'GIZMO-99': { inStock: 42, price: 8.75 },
};

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-rpc-handle-query-client',
  });

  console.log('Connected to KubeMQ server');

  try {
    const channel = 'inventory.lookup';

    const subscription = client.subscribeToQueries({
      channel,
      onQuery: async (query) => {
        console.log('Received query:', query.id);
        const request = JSON.parse(new TextDecoder().decode(query.body));
        const item = inventory[request.sku];

        if (item) {
          await client.sendQueryResponse({
            id: query.id,
            replyChannel: query.replyChannel,
            executed: true,
            body: new TextEncoder().encode(
              JSON.stringify({
                sku: request.sku,
                ...item,
                warehouse: request.warehouse,
              }),
            ),
          });
          console.log('  Responded with inventory data for', request.sku);
        } else {
          await client.sendQueryResponse({
            id: query.id,
            replyChannel: query.replyChannel,
            executed: false,
            error: `SKU not found: ${request.sku}`,
          });
          console.log('  SKU not found:', request.sku);
        }
      },
      onError: (err) => {
        console.error('Subscription error:', err.message);
      },
    });

    console.log(`Listening for queries on "${channel}"...`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const response = await client.sendQuery(
      createQuery({
        channel,
        body: JSON.stringify({ sku: 'WIDGET-42', warehouse: 'east' }),
        timeoutInSeconds: 10,
      }),
    );

    if (response.executed && response.body) {
      const data = JSON.parse(new TextDecoder().decode(response.body));
      console.log('Inventory response:', data);
    } else {
      console.error('Query failed:', response.error);
    }

    subscription.cancel();
    console.log('\nInventory service shut down.');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

Run with:

```bash
npx tsx inventory-service.ts
```

## Expected Output

```
Connected to KubeMQ server
Listening for queries on "inventory.lookup"...
Received query: <query-id>
  Responded with inventory data for WIDGET-42
Inventory response: { sku: 'WIDGET-42', inStock: 150, price: 12.99, warehouse: 'east' }

Inventory service shut down.
```

## Queries vs Commands

| Feature  | Commands                        | Queries                  |
| -------- | ------------------------------- | ------------------------ |
| Response | Execution status (success/fail) | Data payload             |
| Use case | Mutations, actions              | Read operations, lookups |
| Handler  | Returns executed/error          | Returns data in body     |

## Next Steps

- **[Request-Reply with Commands](request-reply-with-commands.md)** — synchronous command execution with status response
- **[Getting Started with Events](getting-started-events.md)** — fire-and-forget messaging
- **Handle queries in a separate process** — run the handler as a long-lived service and send queries from another client
