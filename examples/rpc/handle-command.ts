/**
 * Example: Subscribe to and Handle Commands
 *
 * Demonstrates subscribing to a command channel and responding to incoming
 * commands. The handler processes each command and sends a response back
 * to the sender.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/rpc/handle-command.ts
 */
import { KubeMQClient } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-rpc-handle-command-client' });

  try {
    const subscription = client.subscribeToCommands({
      channel: 'js-rpc.handle-command',
      onCommand: async (cmd) => {
        console.log('Received command:', cmd.id);
        console.log('  Channel:', cmd.channel);
        console.log('  Body:', new TextDecoder().decode(cmd.body));

        const payload = JSON.parse(new TextDecoder().decode(cmd.body));

        // Process the command and send a response.
        const success =
          payload.action === 'set-temperature' && payload.value >= 16 && payload.value <= 30;

        await client.sendCommandResponse({
          id: cmd.id,
          replyChannel: cmd.replyChannel,
          executed: success,
          error: success ? undefined : 'Temperature out of range (16-30°C)',
        });

        console.log('  Response sent:', success ? 'executed' : 'rejected');
      },
      onError: (err) => {
        console.error('Subscription error:', err.message);
      },
    });

    console.log('Listening for commands on "js-rpc.handle-command"...');
    console.log('Press Ctrl+C to stop');

    // Keep the process running until interrupted.
    await new Promise((resolve) => process.on('SIGINT', resolve));

    subscription.cancel();
  } finally {
    await client.close();
  }
}

main().catch(console.error);
