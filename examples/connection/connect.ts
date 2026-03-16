/**
 * Example: Basic Client Connection
 *
 * Demonstrates creating a KubeMQ client with various connection options,
 * verifying the connection with a ping, and inspecting connection state.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/connection/connect.ts
 */
import {
  KubeMQClient,
  ConnectionState,
  createConsoleLogger,
} from '../../src/index.js';

async function main(): Promise<void> {
  // --- Option 1: Minimal connection (address only) ---
  console.log('=== Minimal Connection ===');
  // TODO: Replace with your KubeMQ server address
  const minimal = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-connection-connect-client',
  });

  console.log('Client ID:', minimal.clientId);
  console.log('Address:', minimal.address);
  console.log('State:', minimal.state);

  const info = await minimal.ping();
  console.log('Server version:', info.version);
  console.log('Server uptime:', info.serverUpTime, 'seconds');
  await minimal.close();

  // --- Option 2: Connection with custom options ---
  console.log('\n=== Connection with Options ===');
  const configured = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-connection-connect-configured-client',
    connectionTimeoutMs: 15_000,
    logger: createConsoleLogger('info'),
    keepalive: {
      timeMs: 10_000,
      timeoutMs: 5_000,
      permitWithoutCalls: true,
    },
    retry: {
      maxRetries: 5,
      initialBackoffMs: 500,
      maxBackoffMs: 30_000,
      multiplier: 2.0,
      jitter: 'full',
    },
  });

  console.log('State after create:', configured.state);

  // Listen for connection state changes.
  configured.on('stateChange', (state: ConnectionState) => {
    console.log('State changed to:', state);
  });

  const configuredInfo = await configured.ping();
  console.log('Server host:', configuredInfo.host);
  await configured.close();
  console.log('State after close:', configured.state);
}

main().catch(console.error);

// Expected output:
// === Minimal Connection ===
// Client ID: js-connection-connect-client
// Address: localhost:50000
// State: <connection-state>
// Server version: <version>
// Server uptime: <seconds> seconds
// === Connection with Options ===
// State after create: <connection-state>
// State changed to: <connection-state>
// Server host: <host>
// State after close: <connection-state>
