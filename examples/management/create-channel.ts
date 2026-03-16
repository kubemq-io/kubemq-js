import { KubeMQClient } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-management-create-channel-client',
  });

  try {
    await client.createChannel('js-management.create-channel-events', 'events');
    console.log('Created events channel: js-my-events-channel');

    await client.createChannel('js-management.create-channel-queues', 'queues');
    console.log('Created queues channel: js-my-queue-channel');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
