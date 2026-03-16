import { KubeMQClient, EventStoreType, createEventStoreMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-store-start-new-only-client',
  });

  try {
    const sub = client.subscribeToEventsStore({
      channel: 'js-events-store.start-new-only',
      startFrom: EventStoreType.StartNewOnly,
      onMessage: (event) => {
        console.log(`[seq=${event.sequence}]`, new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Error:', err.message);
      },
    });

    // Allow subscription to fully establish on the server.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await client.publishEventStore(
      createEventStoreMessage({ channel: 'js-events-store.start-new-only', body: 'hello from StartNewOnly' }),
    );

    await new Promise((r) => setTimeout(r, 1000));
    sub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
