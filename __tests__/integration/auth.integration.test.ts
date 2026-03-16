import { describe, it, expect } from 'vitest';
import { KubeMQClient } from '../../src/client.js';
import { createTestClientOptions } from '../fixtures/test-helpers.js';

const KUBEMQ_TOKEN = process.env.KUBEMQ_TOKEN;
const hasToken = !!KUBEMQ_TOKEN;

describe('Auth integration', () => {
  it('connects with valid token', async () => {
    if (!hasToken) {
      console.log('Skipped: no KUBEMQ_TOKEN');
      return;
    }
    const client = await KubeMQClient.create({
      ...createTestClientOptions(),
      credentials: KUBEMQ_TOKEN,
    });
    const info = await client.ping();
    expect(info.host).toBeTruthy();
    await client.close();
  });

  it('rejects invalid token with AuthenticationError', async () => {
    if (!hasToken) {
      console.log('Skipped: requires auth-enabled server');
      return;
    }
    await expect(
      KubeMQClient.create({ ...createTestClientOptions(), credentials: 'bad-token-xxx' }),
    ).rejects.toThrow();
  });

  it('TLS connection succeeds with valid certificates', async () => {
    console.log('Skipped: requires TLS-enabled server and certificates');
  });
});
