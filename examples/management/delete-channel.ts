import { KubeMQClient } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-management-delete-channel-client',
  });

  try {
    await client.deleteChannel('js-management.delete-channel-events', 'events');
    console.log('Deleted events channel: js-my-events-channel');

    await client.deleteChannel('js-management.delete-channel-queues', 'queues');
    console.log('Deleted queues channel: js-my-queue-channel');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
