/**
 * Example: Basic Queue Send/Receive
 *
 * Demonstrates guaranteed delivery messaging with queues. A producer
 * sends messages and a consumer polls for them. Each message is delivered
 * to exactly one consumer and must be acknowledged.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/queues/send-receive.ts
 */
import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main(): Promise<void> {
  // TODO: Replace with your KubeMQ server address
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-send-receive-client',
  });

  try {
    // Send a message to the queue.
    const result = await client.sendQueueMessage(
      createQueueMessage({
        channel: 'js-queues.send-receive',
        body: 'Resize image: /uploads/photo-001.jpg',
        tags: { format: 'jpeg', width: '800' },
      }),
    );
    console.log('Sent message:', result.messageId);

    // Receive messages from the queue.
    const messages = await client.receiveQueueMessages({
      channel: 'js-queues.send-receive',
      waitTimeoutSeconds: 5,
    });

    for (const msg of messages) {
      console.log('Received:', new TextDecoder().decode(msg.body));
      console.log('  Tags:', msg.tags);
      await msg.ack();
      console.log('  Acknowledged');
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);

// Expected output:
// Sent message: <message-id>
// Received: Resize image: /uploads/photo-001.jpg
//   Tags: { format: 'jpeg', width: '800' }
//   Acknowledged
