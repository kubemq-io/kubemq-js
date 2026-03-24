/**
 * Example: Automatic Reconnection with Backoff
 *
 * Demonstrates how the SDK automatically reconnects when the connection
 * is lost. The reconnection policy uses exponential backoff with jitter
 * to avoid thundering herd problems.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/error-handling/reconnection.ts
 */
import { KubeMQClient, ConnectionState, createEventMessage } from '../../src/index.js';

async function main(): Promise<void> {
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-error-handling-reconnection-client',
    // Configure reconnection behavior.
    reconnect: {
      maxAttempts: 10, // -1 for unlimited attempts
      initialDelayMs: 500, // first retry after ~500ms
      maxDelayMs: 30_000, // cap backoff at 30 seconds
      multiplier: 2.0, // double delay each attempt
      jitter: 'full', // randomize to avoid thundering herd
    },
  });

  try {
    // Listen for connection lifecycle events.
    client.on('connected', () => {
      console.log('[Event] Connected');
    });

    client.on('disconnected', () => {
      console.log('[Event] Disconnected');
    });

    client.on('reconnecting', (attempt: number) => {
      console.log(`[Event] Reconnecting (attempt ${attempt})...`);
    });

    client.on('reconnected', () => {
      console.log('[Event] Reconnected successfully');
    });

    client.on('stateChange', (state: ConnectionState) => {
      console.log(`[Event] State changed to: ${state}`);
    });

    client.on('closed', () => {
      console.log('[Event] Client closed');
    });

    // Publish some events to verify the connection is working.
    for (let i = 1; i <= 3; i++) {
      await client.sendEvent(
        createEventMessage({
          channel: 'js-error-handling.reconnection',
          body: `heartbeat-${i}`,
        }),
      );
      console.log(`Published heartbeat #${i}`);
    }

    console.log('\nConnection is active. Current state:', client.state);
    console.log('If the server restarts, the SDK will automatically reconnect.');
    console.log('Waiting 10 seconds to observe any reconnection events...');

    await new Promise((resolve) => setTimeout(resolve, 10_000));
  } finally {
    await client.close();
    console.log('Client closed. Final state:', client.state);
  }
}

main().catch(console.error);
