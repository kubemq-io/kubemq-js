/**
 * Example: Stream Downstream (Receive with Ack/Reject/Requeue)
 *
 * Demonstrates receiving messages from a queue with fine-grained control
 * over each message: acknowledge on success, reject on permanent failure,
 * or requeue for later retry.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *   - Messages in the "js-queues-stream.stream-receive" channel (run stream-send.ts first)
 *
 * Run: npx tsx examples/queues-stream/stream-receive.ts
 */
import { KubeMQClient } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-stream-receive-client',
  });

  try {
    const messages = await client.receiveQueueMessages({
      channel: 'js-queues-stream.stream-receive',
      waitTimeoutSeconds: 10,
      maxMessages: 5,
    });

    console.log(`Received ${messages.length} messages`);

    for (const msg of messages) {
      const body = new TextDecoder().decode(msg.body);
      console.log(`Processing: ${body}`);

      try {
        // Simulate processing.
        await processMessage(body);
        await msg.ack();
        console.log('  ✓ Acknowledged');
      } catch {
        // On failure, reject the message.
        await msg.nack();
        console.log('  ✗ Rejected');
      }
    }
  } finally {
    await client.close();
  }
}

async function processMessage(_body: string): Promise<void> {
  // Simulate occasional failures.
  if (Math.random() < 0.2) {
    throw new Error('Processing failed');
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}

main().catch(console.error);
