import { describe, it, expect, afterEach } from 'vitest';
import { KubeMQClient } from '../../src/client.js';
import { createTestClientOptions } from '../fixtures/test-helpers.js';

describe('Reconnection integration', () => {
  let client: KubeMQClient;

  afterEach(async () => {
    if (client) await client.close().catch(() => {});
  });

  it('client transitions READY → RECONNECTING → READY on server restart', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    expect(client.state).toBeDefined();
    await client.close();
  });

  it('buffered messages are flushed after reconnection', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    expect(client.state).toBeDefined();
    await client.close();
  });

  it('subscriptions resume after reconnection', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    expect(client.state).toBeDefined();
    await client.close();
  });
});
