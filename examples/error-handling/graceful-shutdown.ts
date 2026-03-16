/**
 * Example: Graceful Shutdown
 *
 * Demonstrates how to cleanly shut down a KubeMQ client by cancelling
 * all active subscriptions, allowing in-flight operations to drain,
 * and closing the connection with configurable timeouts.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/error-handling/graceful-shutdown.ts
 */
import {
  KubeMQClient,
  createEventMessage,
  createQueueMessage,
} from '../../src/index.js';
import type { Subscription } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-error-handling-graceful-shutdown-client',
  });

  // Track all active subscriptions for cleanup.
  const subscriptions: Subscription[] = [];

  try {
    // Set up multiple subscriptions.
    const eventSub = client.subscribeToEvents({
      channel: 'js-error-handling.graceful-shutdown-events',
      onMessage: (event) => {
        console.log('[Events] Received:', new TextDecoder().decode(event.body));
      },
      onError: (err) => {
        console.error('[Events] Error:', err.message);
      },
    });
    subscriptions.push(eventSub);
    console.log('Started event subscription');

    const commandSub = client.subscribeToCommands({
      channel: 'js-error-handling.graceful-shutdown-cmds',
      onCommand: async (cmd) => {
        console.log('[Commands] Received:', cmd.id);
        await client.sendCommandResponse({
          id: cmd.id,
          replyChannel: cmd.replyChannel,
          executed: true,
        });
      },
      onError: (err) => {
        console.error('[Commands] Error:', err.message);
      },
    });
    subscriptions.push(commandSub);
    console.log('Started command subscription');

    // Simulate some work.
    await client.publishEvent(
      createEventMessage({
        channel: 'js-error-handling.graceful-shutdown-events',
        body: 'processing started',
      }),
    );

    await client.sendQueueMessage(
      createQueueMessage({
        channel: 'js-error-handling.graceful-shutdown-queue',
        body: 'queued task',
      }),
    );

    console.log('Published event and queued message');

    // Register shutdown handler.
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal} — starting graceful shutdown...`);

      // Step 1: Cancel all subscriptions so no new messages arrive.
      console.log('Step 1: Cancelling subscriptions...');
      for (const sub of subscriptions) {
        sub.cancel();
      }
      console.log(`  Cancelled ${subscriptions.length} subscription(s)`);

      // Step 2: Close the client with drain timeout.
      // This waits for in-flight operations to complete.
      console.log('Step 2: Closing client (draining in-flight operations)...');
      await client.close({
        timeoutMs: 5000,           // max 5s for gRPC operations to drain
        callbackTimeoutMs: 10_000, // max 10s for callbacks to finish
      });

      console.log('Step 3: Shutdown complete. State:', client.state);
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    console.log('\nRunning... Press Ctrl+C for graceful shutdown');
    console.log('(Auto-shutting down in 5 seconds for demo purposes)\n');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Demonstrate programmatic shutdown.
    await shutdown('auto');
  } catch (err) {
    console.error('Unexpected error:', (err as Error).message);

    // Emergency cleanup — cancel subs even on error.
    for (const sub of subscriptions) {
      sub.cancel();
    }
    await client.close();
  }
}

main().catch(console.error);
