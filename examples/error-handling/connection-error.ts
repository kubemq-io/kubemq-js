/**
 * Example: Connection Error Handling
 *
 * Demonstrates handling connection errors when the KubeMQ server is
 * unreachable, misconfigured, or requires authentication. Shows how
 * to catch specific error types and provide actionable diagnostics.
 *
 * Prerequisites:
 *   - This example intentionally connects to an invalid address.
 *
 * Run: npx tsx examples/error-handling/connection-error.ts
 */
import {
  KubeMQClient,
  ConnectionError,
  AuthenticationError,
  KubeMQTimeoutError,
  ConfigurationError,
  KubeMQError,
} from '../../src/index.js';

async function main(): Promise<void> {
  // --- Scenario 1: Unreachable server ---
  console.log('=== Scenario 1: Unreachable Server ===');
  try {
    await KubeMQClient.create({
      address: 'localhost:59999',
      clientId: 'js-error-handling-connection-error-client',
      connectionTimeoutMs: 3000,
    });
  } catch (err) {
    if (err instanceof ConnectionError) {
      console.log('ConnectionError caught:', err.message);
      console.log('  Error code:', err.code);
      console.log('  Is retryable:', err.isRetryable);
      if (err.suggestion) {
        console.log('  Suggestion:', err.suggestion);
      }
    } else if (err instanceof KubeMQTimeoutError) {
      console.log('TimeoutError: Server did not respond within 3 seconds');
    } else {
      console.log('Unexpected error:', (err as Error).message);
    }
  }

  // --- Scenario 2: Invalid configuration ---
  console.log('\n=== Scenario 2: Invalid Configuration ===');
  try {
    await KubeMQClient.create({
      address: '',
      clientId: 'js-error-handling-connection-error-invalid-client',
    });
  } catch (err) {
    if (err instanceof ConfigurationError) {
      console.log('ConfigurationError caught:', err.message);
    } else if (err instanceof KubeMQError) {
      console.log('KubeMQError caught:', err.message);
      console.log('  Code:', err.code);
    } else {
      console.log('Unexpected error:', (err as Error).message);
    }
  }

  // --- Scenario 3: Authentication failure ---
  console.log('\n=== Scenario 3: Authentication Failure (simulated) ===');
  try {
    // This will fail at connection level since server is not running,
    // but demonstrates the pattern for catching auth errors.
    await KubeMQClient.create({
      address: 'localhost:59999',
      clientId: 'js-error-handling-connection-error-auth-client',
      credentials: 'invalid-token',
      connectionTimeoutMs: 3000,
    });
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.log('AuthenticationError: Invalid credentials');
    } else if (err instanceof ConnectionError) {
      console.log('ConnectionError (expected in demo):', err.message);
    } else {
      console.log('Error:', (err as Error).message);
    }
  }

  console.log('\nAll error scenarios demonstrated');
}

main().catch(console.error);
