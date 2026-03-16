import { KubeMQClient, EventStoreType } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-store-start-at-time-delta-client',
  });

  try {
    const sub = client.subscribeToEventsStore({
      channel: 'js-events-store.start-at-time-delta',
      startFrom: EventStoreType.StartAtTimeDelta,
      startValue: 30,
      onMessage: (event) => {
        console.log(`[seq=${event.sequence}]`, new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Error:', err.message);
      },
    });

    console.log('Subscribed with StartAtTimeDelta=30s — replays events from the last 30 seconds');
    await new Promise((r) => setTimeout(r, 2000));
    sub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
