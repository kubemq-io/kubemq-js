/**
 * Example: Subscribe to and Handle Queries
 *
 * Demonstrates subscribing to a query channel and responding with data.
 * The handler processes each query, looks up the requested data, and
 * sends a response containing the result.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/rpc/handle-query.ts
 */
import { KubeMQClient } from '../../src/index.js';

const inventory: Record<string, { inStock: number; price: number }> = {
  'WIDGET-42': { inStock: 150, price: 12.99 },
  'GADGET-7': { inStock: 0, price: 24.5 },
  'GIZMO-99': { inStock: 42, price: 8.75 },
};

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-rpc-handle-query-client' });

  try {
    const subscription = client.subscribeToQueries({
      channel: 'js-rpc.handle-query',
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

    console.log('Listening for queries on "js-rpc.handle-query"...');
    console.log('Press Ctrl+C to stop');

    await new Promise((resolve) => process.on('SIGINT', resolve));
    subscription.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
