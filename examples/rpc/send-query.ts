/**
 * Example: Send Query and Receive Data Response
 *
 * Demonstrates sending a query (request/reply with data response).
 * Queries are used when you need to retrieve data from a responder.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *   - A query handler running (see handle-query.ts)
 *
 * Run: npx tsx examples/rpc/send-query.ts
 */
import { KubeMQClient, createQuery } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-rpc-send-query-client' });

  try {
    const response = await client.sendQuery(
      createQuery({
        channel: 'js-rpc.send-query',
        body: JSON.stringify({ sku: 'WIDGET-42', warehouse: 'east' }),
        timeoutMs: 10_000,
      }),
    );

    if (response.executed && response.body) {
      const data = JSON.parse(new TextDecoder().decode(response.body));
      console.log('Inventory response:', data);
    } else {
      console.error('Query failed:', response.error);
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);

// Expected output:
// Inventory response: { sku: 'WIDGET-42', inStock: 150, price: 12.99, warehouse: 'east' }
