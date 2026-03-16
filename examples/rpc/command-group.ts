import { KubeMQClient, createCommand } from '../../src/index.js';

async function main() {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-rpc-command-group-client',
  });

  try {
    const sub = client.subscribeToCommands({
      channel: 'js-rpc.command-group',
      group: 'handlers',
      onCommand: (cmd) => {
        console.log('Handler received command:', cmd.id);
        client.sendCommandResponse({ id: cmd.id, replyChannel: cmd.replyChannel, executed: true });
      },
      onError: (err) => {
        console.error('Sub error:', err.message);
      },
    });

    await new Promise((r) => setTimeout(r, 500));
    const resp = await client.sendCommand(
      createCommand({ channel: 'js-rpc.command-group', body: 'do-work', timeoutMs: 5000 }),
    );
    console.log('Command executed:', resp.executed);

    sub.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
