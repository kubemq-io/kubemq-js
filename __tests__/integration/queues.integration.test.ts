import { describe, it, expect, afterEach } from 'vitest';
import { KubeMQClient } from '../../src/client.js';
import { createTestClientOptions, uniqueChannel } from '../fixtures/test-helpers.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  });
}

describe('Queues integration', () => {
  let client: KubeMQClient;

  afterEach(async () => {
    if (client) await client.close().catch(() => {});
  });

  it('sends and receives a queue message', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('q-send-recv');

    await client.sendQueueMessage({
      channel,
      body: new TextEncoder().encode('queue-hello'),
      metadata: 'q-meta',
      tags: { priority: 'high' },
    });

    const messages = await client.receiveQueueMessages({
      channel,
      waitTimeoutSeconds: 5,
      maxMessages: 1,
    });

    expect(messages.length).toBe(1);
    expect(new TextDecoder().decode(messages[0].body)).toBe('queue-hello');
    expect(messages[0].metadata).toBe('q-meta');
    expect(messages[0].tags).toEqual(expect.objectContaining({ priority: 'high' }));
  });

  it('ack removes message from queue', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('q-ack');

    await client.sendQueueMessage({
      channel,
      body: new TextEncoder().encode('ack-me'),
    });

    const messages = await client.receiveQueueMessages({
      channel,
      waitTimeoutSeconds: 5,
      maxMessages: 1,
    });
    expect(messages.length).toBe(1);

    const retry = await client.receiveQueueMessages({
      channel,
      waitTimeoutSeconds: 2,
      maxMessages: 1,
    });
    expect(retry.length).toBe(0);
  });

  it('nack returns message to queue', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('q-reject');

    await client.sendQueueMessage({
      channel,
      body: new TextEncoder().encode('reject-me'),
    });

    const handle = client.streamQueueMessages({
      channel,
      waitTimeoutSeconds: 5,
      maxMessages: 1,
    });

    const rejected = await new Promise<boolean>((resolve) => {
      handle.onMessages((msgs) => {
        msgs[0].nack();
        resolve(true);
      });
      handle.onError(() => resolve(false));
      const timer = setTimeout(() => resolve(false), 10_000);
      if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    });
    handle.close();
    expect(rejected).toBe(true);

    await sleep(3000);

    const messages = await client.receiveQueueMessages({
      channel,
      waitTimeoutSeconds: 5,
      maxMessages: 1,
    });
    expect(messages.length).toBe(1);
    expect(new TextDecoder().decode(messages[0].body)).toBe('reject-me');
  });

  it('delayed message not received before delay expires', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('q-delay');

    await client.sendQueueMessage({
      channel,
      body: new TextEncoder().encode('delayed'),
      policy: { delaySeconds: 3 },
    });

    const early = await client.receiveQueueMessages({
      channel,
      waitTimeoutSeconds: 1,
      maxMessages: 1,
    });
    expect(early.length).toBe(0);

    await sleep(4000);

    const late = await client.receiveQueueMessages({
      channel,
      waitTimeoutSeconds: 5,
      maxMessages: 1,
    });
    expect(late.length).toBe(1);
    expect(new TextDecoder().decode(late[0].body)).toBe('delayed');
  });

  it('batch send delivers multiple messages', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('q-batch');
    const count = 3;

    const msgs = Array.from({ length: count }, (_, i) => ({
      channel,
      body: new TextEncoder().encode(`batch-${i}`),
    }));

    const batchResult = await client.sendQueueMessagesBatch(msgs);
    expect(batchResult.successCount).toBe(count);
    expect(batchResult.failureCount).toBe(0);

    const received = await client.receiveQueueMessages({
      channel,
      waitTimeoutSeconds: 5,
      maxMessages: count,
    });
    expect(received.length).toBe(count);
  });

  it('visibility timeout re-queues unacked message', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('q-visibility');

    await client.sendQueueMessage({
      channel,
      body: new TextEncoder().encode('visibility-test'),
    });

    const handle = client.streamQueueMessages({
      channel,
      waitTimeoutSeconds: 5,
      maxMessages: 1,
    });

    const gotMessage = await new Promise<boolean>((resolve) => {
      handle.onMessages(() => {
        resolve(true);
      });
      handle.onError(() => resolve(false));
      const timer = setTimeout(() => resolve(false), 10_000);
      if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    });
    handle.close();
    expect(gotMessage).toBe(true);

    await sleep(3000);

    const messages = await client.receiveQueueMessages({
      channel,
      waitTimeoutSeconds: 5,
      maxMessages: 1,
    });
    expect(messages.length).toBe(1);
    expect(new TextDecoder().decode(messages[0].body)).toBe('visibility-test');
  });
});
