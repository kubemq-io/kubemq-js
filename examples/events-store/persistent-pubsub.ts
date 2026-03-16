/**
 * Example: Persistent Event Publish/Subscribe
 *
 * Demonstrates event store messaging where events are persisted and can be
 * replayed by subscribers. Unlike regular events, subscribers can connect
 * after events are published and still receive them.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/events-store/persistent-pubsub.ts
 */
import { KubeMQClient, createEventStoreMessage, EventStoreType } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-events-store-persistent-pubsub-client' });

  try {
    // Publish events first — they are persisted in the store.
    for (let i = 1; i <= 3; i++) {
      await client.publishEventStore(
        createEventStoreMessage({
          channel: 'js-events-store.persistent-pubsub',
          body: `User action #${i}: login from 192.168.1.${i}`,
          tags: { action: 'login', sequence: String(i) },
        }),
      );
      console.log(`Published event #${i}`);
    }

    // Subscribe starting from the first stored event — replays all three.
    const subscription = client.subscribeToEventsStore({
      channel: 'js-events-store.persistent-pubsub',
      startFrom: EventStoreType.StartNewOnly,
      onMessage: (event) => {
        console.log(`Received [seq=${event.sequence}]:`, new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Subscription error:', err.message);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    subscription.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
