import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-stream-expiration-policy-client',
  });

  try {
    const result = await client.sendQueueMessage(
      createQueueMessage({
        channel: 'js-queues-stream.expiration-policy',
        body: 'this message expires in 30 seconds',
        policy: { expirationSeconds: 30 },
      }),
    );

    console.log('Sent message ID:', result.messageId);
    const expiresAt = result.expirationAt instanceof Date && !isNaN(result.expirationAt.getTime())
      ? result.expirationAt.toISOString()
      : 'N/A';
    console.log('Expires at:', expiresAt);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
