/**
 * Example: Replay Events from a Specific Sequence Number
 *
 * Demonstrates subscribing to an event store starting from a specific
 * sequence number. Useful for resuming processing after a crash by
 * tracking the last processed sequence.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/events-store/replay-from-sequence.ts
 */
import { KubeMQClient, createEventStoreMessage, EventStoreStartPosition } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-store-replay-from-sequence-client',
  });

  try {
    // Publish several events.
    for (let i = 1; i <= 5; i++) {
      await client.sendEventStore(
        createEventStoreMessage({
          channel: 'js-events-store.replay-from-sequence',
          body: `Payment #${i}: $${(i * 49.99).toFixed(2)}`,
        }),
      );
    }

    // Subscribe from sequence 3 — only events #3, #4, #5 are received.
    const subscription = client.subscribeToEventsStore({
      channel: 'js-events-store.replay-from-sequence',
      startFrom: EventStoreStartPosition.StartAtSequence,
      startValue: 3,
      onEvent: (event) => {
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
