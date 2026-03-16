/**
 * Example: TLS Connection Setup
 *
 * Demonstrates connecting to a KubeMQ server with TLS encryption.
 * The client verifies the server's certificate against the provided
 * CA certificate.
 *
 * Prerequisites:
 *   - KubeMQ server running with TLS enabled
 *   - CA certificate file available locally
 *
 * Run: npx tsx examples/configuration/tls-setup.ts
 */
import { KubeMQClient, ConnectionError } from '../../src/index.js';

async function main(): Promise<void> {
  try {
    const client = await KubeMQClient.create({
      address: 'kubemq-server:50000',
      clientId: 'js-configuration-tls-setup-client',
      tls: {
        enabled: true,
        caCert: '/path/to/ca-cert.pem',
      },
    });

    console.log('Connected to KubeMQ with TLS');
    console.log('Connection state:', client.state);

    await client.close();
  } catch (err) {
    if (err instanceof ConnectionError) {
      console.error('TLS connection failed:', err.message);
      console.error('Suggestion:', err.suggestion);
    }
  }
}

main().catch(console.error);
