/**
 * Example: Token Authentication
 *
 * Demonstrates connecting to a KubeMQ server with token-based
 * authentication. You can pass a static token string or use a
 * CredentialProvider for dynamic token refresh.
 *
 * Prerequisites:
 *   - KubeMQ server running with authentication enabled
 *
 * Run: npx tsx examples/configuration/token-auth.ts
 */
import { KubeMQClient, StaticTokenProvider, AuthenticationError } from '../../src/index.js';

async function main(): Promise<void> {
  // Option 1: Pass a token string directly.
  try {
    const client = await KubeMQClient.create({
      address: 'localhost:50000',
      clientId: 'js-configuration-token-auth-client',
      credentials: 'your-jwt-auth-token',
    });

    console.log('Connected with static token');
    await client.close();
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.error('Auth failed:', err.message);
    }
  }

  // Option 2: Use a StaticTokenProvider (same result, explicit provider pattern).
  try {
    const client = await KubeMQClient.create({
      address: 'localhost:50000',
      clientId: 'js-configuration-token-auth-client',
      credentials: new StaticTokenProvider('your-jwt-auth-token'),
    });

    console.log('Connected with StaticTokenProvider');
    await client.close();
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.error('Auth failed:', err.message);
    }
  }
}

main().catch(console.error);
