/**
 * End-to-end roundtrip benchmark — requires a running KubeMQ server.
 *
 * This benchmark is skipped by default. To run:
 *   1. Start a KubeMQ server: `npm run bench:setup`
 *   2. Run benchmarks: `npm run bench`
 *   3. Tear down: `npm run bench:teardown`
 *
 * When no server is available, this file does nothing.
 */
import { bench, describe, beforeAll, afterAll } from 'vitest';

const KUBEMQ_ADDRESS = process.env['KUBEMQ_ADDRESS'] ?? 'localhost:50000';

describe('Roundtrip (requires KubeMQ server)', () => {
  let client: unknown;
  let available = false;

  beforeAll(async () => {
    try {
      const sdk = await import('../src/index.js');
      const c = await sdk.KubeMQClient.create({
        address: KUBEMQ_ADDRESS,
        connectionTimeoutMs: 3_000,
      });
      client = c;
      available = true;
    } catch {
      // Server not available — benchmarks will be no-ops
    }
  });

  afterAll(async () => {
    if (available && client) {
      await (client as { close: () => Promise<void> }).close();
    }
  });

  bench(
    'Ping roundtrip',
    async () => {
      if (!available) return;
      await (client as { ping: () => Promise<unknown> }).ping();
    },
    {
      warmupIterations: available ? 10 : 0,
      iterations: available ? 200 : 1,
    },
  );
});
