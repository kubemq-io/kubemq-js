/**
 * Example: Custom Timeout Configuration
 *
 * Demonstrates configuring custom timeouts at the client level and
 * per-operation level. Also shows how to use AbortSignal for explicit
 * cancellation control.
 *
 * Prerequisites:
 *   - KubeMQ server running on localhost:50000
 *
 * Run: npx tsx examples/configuration/custom-timeouts.ts
 */
import { KubeMQClient, createEventMessage, CancellationError, KubeMQTimeoutError } from '../../src/index.js';

async function main(): Promise<void> {
  // Client-level timeout configuration.
  const client = await KubeMQClient.create({
    address: 'localhost:50000',
    clientId: 'js-configuration-custom-timeouts-client',
    connectionTimeoutMs: 15_000,
    retry: {
      maxRetries: 5,
      initialBackoffMs: 1000,
      maxBackoffMs: 30_000,
      multiplier: 2.0,
      jitter: 'full',
    },
  });

  try {
    // Per-operation timeout override.
    await client.publishEvent(
      createEventMessage({ channel: 'js-configuration.custom-timeouts', body: 'p99=42ms' }),
      { timeout: 2000 },
    );
    console.log('Published with 2-second timeout');

    // AbortSignal-based cancellation.
    const controller = new AbortController();
    setTimeout(() => {
      controller.abort();
    }, 3000);

    try {
      await client.publishEvent(
        createEventMessage({ channel: 'js-configuration.custom-timeouts', body: 'p99=38ms' }),
        { signal: controller.signal },
      );
      console.log('Published before cancellation');
    } catch (err) {
      if (err instanceof CancellationError) {
        console.log('Operation was cancelled by AbortSignal');
      } else if (err instanceof KubeMQTimeoutError) {
        console.log('Operation timed out');
      }
    }
  } finally {
    await client.close();
  }
}

main().catch(console.error);
