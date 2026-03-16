import { KubeMQClient, EventStoreType, createEventStoreMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-store-cancel-subscription-client',
  });

  try {
    let count = 0;
    const sub = client.subscribeToEventsStore({
      channel: 'js-events-store.cancel-subscription',
      startFrom: EventStoreType.StartNewOnly,
      onMessage: (event) => {
        count++;
        console.log(`Received #${count}:`, new TextDecoder().decode(event.body));
        if (count >= 2) sub.cancel();
      },
      onError: (err) => {
        console.error('Error:', err.message);
      },
    });

    for (let i = 1; i <= 5; i++) {
      await client.publishEventStore(
        createEventStoreMessage({ channel: 'js-events-store.cancel-subscription', body: `msg-${i}` }),
      );
    }

    await new Promise((r) => setTimeout(r, 1000));
    console.log('Subscription cancelled after', count, 'messages');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
