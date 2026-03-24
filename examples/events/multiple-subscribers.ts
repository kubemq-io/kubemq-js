/**
 * Example: Multiple Subscribers on the Same Channel
 *
 * Demonstrates that multiple subscribers on the same channel each receive
 * a copy of every published event (fan-out). Use the `group` option for
 * load-balanced (competing consumer) behavior instead.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/events/multiple-subscribers.ts
 */
import { KubeMQClient, createEventMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-events-multiple-subscribers-client',
  });

  try {
    // Both subscribers receive every event (fan-out).
    const sub1 = client.subscribeToEvents({
      channel: 'js-events.multiple-subscribers',
      onEvent: (event) => {
        console.log('[Subscriber A]', new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Sub A error:', err.message);
      },
    });

    const sub2 = client.subscribeToEvents({
      channel: 'js-events.multiple-subscribers',
      onEvent: (event) => {
        console.log('[Subscriber B]', new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('Sub B error:', err.message);
      },
    });

    // Allow subscriptions to fully establish on the server.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await client.sendEvent(
      createEventMessage({ channel: 'js-events.multiple-subscribers', body: 'cpu_usage=72%' }),
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    sub1.cancel();
    sub2.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
