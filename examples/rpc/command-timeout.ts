import { KubeMQClient, createCommand, KubeMQTimeoutError } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-rpc-command-timeout-client',
  });

  try {
    const resp = await client.sendCommand(
      createCommand({ channel: 'js-rpc.command-timeout', body: 'ping', timeoutInSeconds: 1 }),
    );
    console.log('Executed:', resp.executed);
  } catch (err) {
    if (err instanceof KubeMQTimeoutError) {
      console.log('Command timed out after 1s — no handler responded');
    } else {
      throw err;
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
