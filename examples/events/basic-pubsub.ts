/**
 * Example: Basic Event Publish/Subscribe
 *
 * Demonstrates fire-and-forget event messaging where a publisher sends
 * events to a channel and one or more subscribers receive them.
 * Events are not persisted — subscribers must be connected to receive them.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/events/basic-pubsub.ts
 */
import { KubeMQClient, createEventMessage } from '../../src/index.js';

async function main(): Promise<void> {
  // TODO: Replace with your KubeMQ server address
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-events-basic-pubsub-client' });

  try {
    const subscription = client.subscribeToEvents({
      channel: 'js-events.basic-pubsub',
      onMessage: (event) => {
        console.log('Received event:', new TextDecoder().decode(event.body));
        console.log('  Channel:', event.channel);
        console.log('  Timestamp:', event.timestamp);
      },
      onError: (err) => {
        console.error('Subscription error:', err.message);
      },
    });

    // Allow subscription to fully establish on the server.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await client.publishEvent(
      createEventMessage({
        channel: 'js-events.basic-pubsub',
        body: 'New user registered: alice@example.com',
        metadata: 'signup-service',
        tags: { source: 'registration-api', priority: 'normal' },
      }),
    );

    console.log('Event published successfully');

    // Allow time for the subscriber to receive the message.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    subscription.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
