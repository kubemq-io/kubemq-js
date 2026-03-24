/**
 * Example: Delayed Message Delivery
 *
 * Demonstrates sending queue messages with a delay. The message is accepted
 * immediately but only becomes visible to consumers after the delay expires.
 * Useful for scheduling future work.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues/delayed-messages.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-delayed-messages-client',
  });

  try {
    // Send a message delayed by 10 seconds.
    const result = await client.sendQueueMessage(
      createQueueMessage({
        channel: 'js-queues.delayed-messages',
        body: 'Send follow-up email to user@example.com',
        policy: {
          delaySeconds: 10,
        },
      }),
    );

    console.log('Sent delayed message:', result.messageId);
    console.log('Message will become visible at:', result.delayedTo?.toISOString());

    // Immediate poll returns nothing — message is still delayed.
    const immediate = await client.receiveQueueMessages({
      channel: 'js-queues.delayed-messages',
      waitTimeoutSeconds: 2,
    });
    console.log('Immediate poll received:', immediate.length, 'messages');

    // Wait for the delay to expire, then poll again.
    console.log('Waiting 11 seconds for delay to expire...');
    await new Promise((resolve) => setTimeout(resolve, 11_000));

    const delayed = await client.receiveQueueMessages({
      channel: 'js-queues.delayed-messages',
      waitTimeoutSeconds: 5,
    });

    for (const msg of delayed) {
      console.log('Received delayed message:', new TextDecoder().decode(msg.body));
      await msg.ack();
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
