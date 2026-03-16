/**
 * Example: Replay Events from a Specific Timestamp
 *
 * Demonstrates subscribing to an event store starting from a specific
 * point in time. Useful for replaying events that occurred after a known
 * timestamp (e.g., "replay everything since last deployment").
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/events-store/replay-from-time.ts
 */
import { KubeMQClient, createEventStoreMessage, EventStoreType } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-events-store-replay-from-time-client' });

  try {
    await client.publishEventStore(
      createEventStoreMessage({
        channel: 'js-events-store.replay-from-time',
        body: 'Deployed v2.4.1 to production',
      }),
    );

    // Subscribe from 60 seconds ago — catches recent events.
    const subscription = client.subscribeToEventsStore({
      channel: 'js-events-store.replay-from-time',
      startFrom: EventStoreType.StartAtTimeDelta,
      startValue: 60, // seconds ago
      onMessage: (event) => {
        console.log(`[${event.timestamp.toISOString()}] ${new TextDecoder().decode(event.body)}`);
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
