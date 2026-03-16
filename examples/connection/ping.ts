import { KubeMQClient } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-connection-ping-client',
  });

  try {
    const info = await client.ping();
    console.log('Server host:', info.host);
    console.log('Server version:', info.version);
    console.log('Uptime (s):', info.serverUpTime);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
