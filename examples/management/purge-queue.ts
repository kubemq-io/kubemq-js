import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-management-purge-queue-client',
  });

  try {
    for (let i = 1; i <= 5; i++) {
      await client.sendQueueMessage(
        createQueueMessage({ channel: 'js-management.purge-queue', body: `msg-${i}` }),
      );
    }
    console.log('Sent 5 messages');

    await client.purgeQueue('js-management.purge-queue');
    console.log('Queue purged successfully');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
