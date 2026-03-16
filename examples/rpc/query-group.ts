import { KubeMQClient, createQuery } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-rpc-query-group-client',
  });

  try {
    const sub = client.subscribeToQueries({
      channel: 'js-rpc.query-group',
      group: 'responders',
      onQuery: (q) => {
        console.log('Group handler received query:', q.id);
        client.sendQueryResponse({
          id: q.id,
          replyChannel: q.replyChannel,
          executed: true,
          body: new TextEncoder().encode(JSON.stringify({ answer: 42 })),
        });
      },
      onError: (err) => {
        console.error('Sub error:', err.message);
      },
    });

    await new Promise((r) => setTimeout(r, 500));
    const resp = await client.sendQuery(
      createQuery({ channel: 'js-rpc.query-group', body: 'question', timeoutMs: 5000 }),
    );
    console.log('Query executed:', resp.executed);
    if (resp.body) console.log('Response body:', new TextDecoder().decode(resp.body));

    sub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
