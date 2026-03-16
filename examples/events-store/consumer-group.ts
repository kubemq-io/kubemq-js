import { KubeMQClient, EventStoreType, createEventStoreMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-store-consumer-group-client',
  });

  try {
    const sub = client.subscribeToEventsStore({
      channel: 'js-events-store.consumer-group',
      group: 'workers',
      startFrom: EventStoreType.StartNewOnly,
      onMessage: (event) => {
        console.log(`[group=workers] seq=${event.sequence}`, new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Error:', err.message);
      },
    });

    for (let i = 1; i <= 3; i++) {
      await client.publishEventStore(
        createEventStoreMessage({ channel: 'js-events-store.consumer-group', body: `group-msg-${i}` }),
      );
    }

    await new Promise((r) => setTimeout(r, 1000));
    sub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
