/**
 * Example: Query with Cache Key and TTL
 *
 * Demonstrates sending a query with caching enabled. The first query is a
 * cache miss (the handler responds), and the second query is a cache hit
 * (served directly from the KubeMQ server cache without calling the handler).
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/rpc/cached-query.ts
 */
import { KubeMQClient, createQuery } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-rpc-cached-query-client',
  });

  try {
    // Set up a query handler so there is a responder for the first (uncached) query.
    const sub = client.subscribeToQueries({
      channel: 'js-rpc.cached-query',
      onQuery: (q) => {
        console.log('Handler called for query:', q.id);
        client.sendQueryResponse({
          id: q.id,
          replyChannel: q.replyChannel,
          executed: true,
          body: new TextEncoder().encode(JSON.stringify({ sku: 'WIDGET-42', qty: 128 })),
        });
      },
      onError: (err) => {
        console.error('Subscription error:', err.message);
      },
    });

    // Wait for the subscription to register on the server.
    await new Promise((r) => setTimeout(r, 500));

    const query = createQuery({
      channel: 'js-rpc.cached-query',
      body: JSON.stringify({ sku: 'WIDGET-42', warehouse: 'east' }),
      timeoutInSeconds: 10,
      cacheKey: 'inventory:WIDGET-42:east',
      cacheTtlInSeconds: 60,
    });

    // First query hits the responder (cache miss).
    console.log('Sending first query (expect cache miss)...');
    const response1 = await client.sendQuery(query);
    console.log(
      'Response 1 — executed:',
      response1.executed,
      '| cacheHit:',
      response1.cacheHit ?? false,
    );

    // Second query returns cached response — handler is not called.
    console.log('Sending second query (expect cache hit)...');
    const response2 = await client.sendQuery(query);
    console.log(
      'Response 2 — executed:',
      response2.executed,
      '| cacheHit:',
      response2.cacheHit ?? false,
    );

    sub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
