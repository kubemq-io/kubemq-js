import { KubeMQClient, createQuery } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-rpc-query-cache-hit-client',
  });

  try {
    const sub = client.subscribeToQueries({
      channel: 'js-rpc.query-cache-hit',
      onQuery: (q) => {
        console.log('Handler called for query:', q.id);
        client.sendQueryResponse({
          id: q.id,
          replyChannel: q.replyChannel,
          executed: true,
          body: new TextEncoder().encode('cached-result'),
        });
      },
      onError: (err) => {
        console.error('Sub error:', err.message);
      },
    });

    await new Promise((r) => setTimeout(r, 500));

    const q = createQuery({
      channel: 'js-rpc.query-cache-hit',
      body: 'lookup',
      timeoutInSeconds: 5,
      cacheKey: 'my-key',
      cacheTtlInSeconds: 60,
    });
    const r1 = await client.sendQuery(q);
    console.log('Response 1 — cacheHit:', r1.cacheHit ?? false);

    const r2 = await client.sendQuery(q);
    console.log('Response 2 — cacheHit:', r2.cacheHit ?? false);

    sub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
