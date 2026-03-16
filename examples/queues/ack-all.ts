import { KubeMQClient, createQueueMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-queues-ack-all-client',
  });

  try {
    for (let i = 1; i <= 5; i++) {
      await client.sendQueueMessage(
        createQueueMessage({ channel: 'js-queues.ack-all', body: `msg-${i}` }),
      );
    }
    console.log('Sent 5 messages');

    const affected = await client.ackAllQueueMessages('js-queues.ack-all', 2);
    console.log('Acknowledged', affected, 'messages');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
