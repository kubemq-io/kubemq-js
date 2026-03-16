/**
 * Example: Wildcard Channel Subscription
 *
 * Demonstrates subscribing to multiple channels using wildcard patterns.
 * A wildcard subscription receives events from all channels matching the pattern.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/events/wildcard-subscription.ts
 */
import { KubeMQClient, createEventMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-events-wildcard-subscription-client' });

  try {
    // Subscribe to all channels under "js-events.wildcard-subscription.*"
    const subscription = client.subscribeToEvents({
      channel: 'js-events.wildcard-subscription.*',
      onMessage: (event) => {
        console.log(`[${event.channel}] ${new TextDecoder().decode(event.body)}`);
      },
      onError: (err) => {
        console.error('Subscription error:', err.message);
      },
    });

    // Publish to different sub-channels — all match the wildcard.
    await client.publishEvent(
      createEventMessage({ channel: 'js-events.wildcard-subscription.created', body: 'Order #1001 created' }),
    );
    await client.publishEvent(
      createEventMessage({ channel: 'js-events.wildcard-subscription.shipped', body: 'Order #1001 shipped' }),
    );
    await client.publishEvent(
      createEventMessage({ channel: 'js-events.wildcard-subscription.delivered', body: 'Order #1001 delivered' }),
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));
    subscription.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
