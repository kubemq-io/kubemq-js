/**
 * Example: Events Subscribe with Consumer Group
 *
 * Demonstrates load-balanced event delivery using a consumer group.
 * Two subscribers join the same group — each event is delivered to
 * exactly one subscriber in the group instead of being fanned out
 * to all of them.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/events/consumer-group.ts
 */
import { KubeMQClient, createEventMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-consumer-group-client',
  });

  try {
    const sub1 = client.subscribeToEvents({
      channel: 'js-events.consumer-group',
      group: 'workers',
      onEvent: (event) => {
        console.log('[Worker A]', new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Worker A error:', err.message);
      },
    });

    const sub2 = client.subscribeToEvents({
      channel: 'js-events.consumer-group',
      group: 'workers',
      onEvent: (event) => {
        console.log('[Worker B]', new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Worker B error:', err.message);
      },
    });

    for (let i = 1; i <= 6; i++) {
      await client.sendEvent(
        createEventMessage({ channel: 'js-events.consumer-group', body: `task-${i}` }),
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    sub1.cancel();
    sub2.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
