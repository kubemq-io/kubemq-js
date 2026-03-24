import { KubeMQClient, createEventMessage } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-connection-close-client',
  });

  try {
    await client.sendEvent(
      createEventMessage({ channel: 'js-connection.close', body: 'hello before close' }),
    );
    console.log('Event sent successfully');
  } finally {
    await client.close();
    console.log('Client closed gracefully');
  }
}

main().catch(console.error);
