/**
 * Example: Message Acknowledgment and Rejection
 *
 * Demonstrates the two message handling options after receiving a queue
 * message via simple receive: acknowledge (success) or reject (send to
 * dead-letter queue).
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues/ack-reject.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-queues-ack-reject-client' });

  try {
    // Send test messages with different intents.
    for (const task of ['valid-task', 'bad-format', 'another-valid-task']) {
      await client.sendQueueMessage(
        createQueueMessage({
          channel: 'js-queues.ack-reject',
          body: task,
          tags: { type: task },
        }),
      );
    }

    const messages = await client.receiveQueueMessages({
      channel: 'js-queues.ack-reject',
      visibilitySeconds: 30,
      waitTimeoutSeconds: 5,
      maxMessages: 10,
    });

    for (const msg of messages) {
      const body = new TextDecoder().decode(msg.body);

      if (body === 'bad-format') {
        // Permanently reject — message goes to dead-letter queue if configured.
        await msg.reject();
        console.log('Rejected:', body);
      } else {
        // Acknowledge successful processing.
        await msg.ack();
        console.log('Acknowledged:', body);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
