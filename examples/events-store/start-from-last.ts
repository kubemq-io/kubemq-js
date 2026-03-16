import { KubeMQClient, EventStoreType, createEventStoreMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-store-start-from-last-client',
  });

  try {
    await client.publishEventStore(
      createEventStoreMessage({ channel: 'js-events-store.start-from-last', body: 'pre-existing message' }),
    );

    const sub = client.subscribeToEventsStore({
      channel: 'js-events-store.start-from-last',
      startFrom: EventStoreType.StartFromLast,
      onMessage: (event) => {
        console.log(`[seq=${event.sequence}]`, new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Error:', err.message);
      },
    });

    await new Promise((r) => setTimeout(r, 1000));
    sub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
