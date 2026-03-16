/**
 * Example: Send Command
 *
 * Demonstrates sending a command (request/reply with no response payload).
 * Commands are used when you need confirmation that an action was executed
 * but don't need data back.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *   - A command handler running (see handle-command.ts)
 *
 * Run: npx tsx examples/rpc/send-command.ts
 */
import { KubeMQClient, createCommand, ConnectionError, KubeMQTimeoutError } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({ address: 'localhost:50000', clientId: 'js-rpc-send-command-client' });

  try {
    const response = await client.sendCommand(
      createCommand({
        channel: 'js-rpc.send-command',
        body: JSON.stringify({ action: 'set-temperature', value: 22 }),
        timeoutMs: 5000,
        tags: { device: 'thermostat-living-room' },
      }),
    );

    if (response.executed) {
      console.log('Command executed successfully');
    } else {
      console.error('Command failed:', response.error);
    }
  } catch (err) {
    if (err instanceof KubeMQTimeoutError) {
      console.error('Command timed out — no handler responded within 5 seconds');
    } else if (err instanceof ConnectionError) {
      console.error('Connection error:', (err as ConnectionError).message);
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
