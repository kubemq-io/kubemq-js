import { KubeMQClient } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-management-list-channels-client',
  });

  try {
    const channels = await client.listChannels('queues', 'js-');
    console.log('Found', channels.length, 'queue channels matching "js-":');
    for (const ch of channels) {
      console.log(`  ${ch.name} — type: ${ch.type}, active: ${ch.isActive}`);
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
