/**
 * Example: Dead-Letter Queue with maxReceiveCount
 *
 * Demonstrates configuring messages to automatically move to a dead-letter
 * queue after a specified number of delivery attempts. This prevents poison
 * messages from blocking the queue.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues/dead-letter-queue.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-queues-dead-letter-queue-client' });

  try {
    // Send a message with a dead-letter policy: after 3 failed deliveries,
    // automatically move to the dead-letter queue.
    await client.sendQueueMessage(
      createQueueMessage({
        channel: 'js-queues.dead-letter-queue',
        body: 'Order #5001: ship to warehouse B',
        policy: {
          maxReceiveCount: 3,
          maxReceiveQueue: 'js-queues.dead-letter-queue-dlq',
        },
      }),
    );
    console.log('Sent message with DLQ policy (max 3 attempts)');

    // Simulate processing failure — receive but don't ack.
    // After visibility timeout, the message becomes available again.
    // After 3 total receives, it moves to 'js-queues.dead-letter-queue-dlq'.
    const messages = await client.receiveQueueMessages({
      channel: 'js-queues.dead-letter-queue',
      visibilitySeconds: 5,
      waitTimeoutSeconds: 5,
    });

    for (const msg of messages) {
      console.log('Received (attempt #%d):', msg.receiveCount, new TextDecoder().decode(msg.body));
      // Intentionally not acking — simulating a processing failure.
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
