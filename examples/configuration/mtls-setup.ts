/**
 * Example: Mutual TLS (mTLS) Setup
 *
 * Demonstrates connecting with mutual TLS where both the client and
 * server authenticate each other using certificates. This provides
 * the strongest transport-level security.
 *
 * Prerequisites:
 *   - KubeMQ server configured for mTLS
 *   - Client certificate, key, and CA certificate files available
 *
 * Run: npx tsx examples/configuration/mtls-setup.ts
 */
import { KubeMQClient, ConnectionError } from '../../src/index.js';

async function main(): Promise<void> {
  try {
    const client = await KubeMQClient.create({
      address: 'kubemq-server:50000',
      clientId: 'js-configuration-mtls-setup-client',
      tls: {
        enabled: true,
        caCert: '/path/to/ca-cert.pem',
        clientCert: '/path/to/client-cert.pem',
        clientKey: '/path/to/client-key.pem',
      },
    });

    console.log('Connected to KubeMQ with mutual TLS');
    console.log('Connection state:', client.state);

    await client.close();
  } catch (err) {
    if (err instanceof ConnectionError) {
      console.error('mTLS connection failed:', err.message);
      console.error('Verify that:');
      console.error('  1. CA cert matches the server certificate issuer');
      console.error('  2. Client cert and key are a matching pair');
      console.error('  3. Certificates have not expired');
    }
  }
}

main().catch(console.error);
