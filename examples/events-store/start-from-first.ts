/**
 * Example: Replay All Events from the Beginning
 *
 * Demonstrates subscribing to an event store starting from the very first
 * stored event. Useful for rebuilding state from scratch (event sourcing).
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/events-store/start-from-first.ts
 */
import { KubeMQClient, createEventStoreMessage, EventStoreType } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-events-store-start-from-first-client' });

  try {
    // Publish some events first.
    const events = ['User created', 'Profile updated', 'Email verified'];
    for (const action of events) {
      await client.publishEventStore(
        createEventStoreMessage({
          channel: 'js-events-store.start-from-first',
          body: action,
        }),
      );
    }

    // Replay all events from the very first one.
    const subscription = client.subscribeToEventsStore({
      channel: 'js-events-store.start-from-first',
      startFrom: EventStoreType.StartFromFirst,
      onMessage: (event) => {
        console.log(`[seq=${event.sequence}] ${new TextDecoder().decode(event.body)}`);
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
