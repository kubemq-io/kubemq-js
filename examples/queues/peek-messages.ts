/**
 * Example: Peek (Waiting) Messages Without Consuming
 *
 * Demonstrates peeking at messages in a queue without removing them.
 * Useful for monitoring queue depth or inspecting messages before
 * deciding whether to process them.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues/peek-messages.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-queues-peek-messages-client' });

  try {
    // Send a few messages to inspect.
    for (let i = 1; i <= 3; i++) {
      await client.sendQueueMessage(
        createQueueMessage({
          channel: 'js-queues.peek-messages',
          body: `Report #${i} ready for review`,
        }),
      );
    }

    // Peek at waiting messages — they remain in the queue.
    const peeked = await client.receiveQueueMessages({
      channel: 'js-queues.peek-messages',
      visibilitySeconds: 0, // peek mode
      waitTimeoutSeconds: 5,
      maxMessages: 10,
    });

    console.log(`Found ${peeked.length} messages waiting:`);
    for (const msg of peeked) {
      console.log(`  - ${new TextDecoder().decode(msg.body)}`);
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
