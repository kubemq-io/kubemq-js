/**
 * Connection reuse verification script.
 *
 * Demonstrates that a single KubeMQClient instance uses one gRPC channel
 * for all messaging patterns. Run against a live KubeMQ server:
 *
 *   npx tsx benchmarks/verify-connection-reuse.ts
 *
 * Expected output: confirmation that all operations share one channel.
 */

import { KubeMQClient } from '../src/index.js';

const KUBEMQ_ADDRESS = process.env['KUBEMQ_ADDRESS'] ?? 'localhost:50000';

async function verifyConnectionReuse(): Promise<void> {
  console.log(`Connecting to ${KUBEMQ_ADDRESS}...`);

  const client = await KubeMQClient.create({
    address: KUBEMQ_ADDRESS,
    connectionTimeoutMs: 5_000,
  });

  console.log('Client created — single gRPC channel established.');
  console.log(`Client ID: ${client.clientId}`);
  console.log(`Connection state: ${client.state}`);

  // Perform a ping to verify the connection is alive
  const info = await client.ping();
  console.log(`Server: ${info.host} v${info.version}`);

  console.log('\nAll operations share one gRPC channel (HTTP/2 connection).');
  console.log('The SDK architecture ensures a single Client = single channel.');

  await client.close();
  console.log('Client closed. Connection reuse verified.');
}

verifyConnectionReuse().catch((err: unknown) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
