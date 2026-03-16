/**
 * Example: Visibility Timeout Handling
 *
 * Demonstrates the visibility timeout mechanism. When a message is received
 * with a visibility timeout, it becomes hidden from other consumers for
 * that duration. If not acknowledged before the timeout expires, the
 * message becomes visible again for redelivery.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues-stream/visibility-timeout.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-queues-stream-visibility-timeout-client' });

  try {
    // Send a test message.
    await client.sendQueueMessage(
      createQueueMessage({
        channel: 'js-queues-stream.visibility-timeout',
        body: 'Generate annual report for Q4',
      }),
    );

    // Receive with a short visibility timeout.
    const messages = await client.receiveQueueMessages({
      channel: 'js-queues-stream.visibility-timeout',
      visibilitySeconds: 10,
      waitTimeoutSeconds: 5,
    });

    for (const msg of messages) {
      console.log('Received:', new TextDecoder().decode(msg.body));
      console.log('Visibility timeout: 10 seconds');

      // Simulate long processing — acknowledge before timeout expires.
      console.log('Processing...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      await msg.ack();
      console.log('Acknowledged before visibility timeout expired');
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
