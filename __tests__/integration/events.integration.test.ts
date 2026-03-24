import { describe, it, expect, afterEach } from 'vitest';
import { KubeMQClient } from '../../src/client.js';
import { createTestClientOptions, uniqueChannel } from '../fixtures/test-helpers.js';
import type { EventReceived } from '../../src/messages/events.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  });
}

describe('Events integration', () => {
  let client: KubeMQClient;

  afterEach(async () => {
    if (client) await client.close().catch(() => {});
  });

  it('publishes and receives a single event', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('events-single');
    const received: EventReceived[] = [];

    const sub = client.subscribeToEvents({
      channel,
      group: '',
      onEvent: (msg) => received.push(msg),
      onError: () => {},
    });
    await sleep(500);

    await client.sendEvent({ channel, body: new TextEncoder().encode('hello') });
    await sleep(1000);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(new TextDecoder().decode(received[0].body)).toBe('hello');
    sub.cancel();
  });

  it('publishes event with metadata and tags', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('events-meta');
    const received: EventReceived[] = [];

    const sub = client.subscribeToEvents({
      channel,
      group: '',
      onEvent: (msg) => received.push(msg),
      onError: () => {},
    });
    await sleep(500);

    await client.sendEvent({
      channel,
      body: new TextEncoder().encode('body'),
      metadata: 'my-metadata',
      tags: { key1: 'value1', key2: 'value2' },
    });
    await sleep(1000);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].metadata).toBe('my-metadata');
    expect(received[0].tags).toEqual(expect.objectContaining({ key1: 'value1' }));
    sub.cancel();
  });

  it('group-based subscription delivers to one consumer', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('events-group');
    const received1: EventReceived[] = [];
    const received2: EventReceived[] = [];
    const group = 'test-group';

    const sub1 = client.subscribeToEvents({
      channel,
      group,
      onEvent: (msg) => received1.push(msg),
      onError: () => {},
    });
    const sub2 = client.subscribeToEvents({
      channel,
      group,
      onEvent: (msg) => received2.push(msg),
      onError: () => {},
    });
    await sleep(500);

    await client.sendEvent({ channel, body: new TextEncoder().encode('group-msg') });
    await sleep(1000);

    expect(received1.length + received2.length).toBe(1);
    sub1.cancel();
    sub2.cancel();
  });

  it('subscription cancel stops data delivery', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('events-cancel');
    const received: EventReceived[] = [];

    const sub = client.subscribeToEvents({
      channel,
      group: '',
      onEvent: (msg) => received.push(msg),
      onError: () => {},
    });
    await sleep(500);
    sub.cancel();
    await sleep(200);

    await client.sendEvent({ channel, body: new TextEncoder().encode('after-cancel') });
    await sleep(500);

    expect(received.length).toBe(0);
  });

  it('multiple subscribers on same channel all receive events', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('events-multi');
    const received1: EventReceived[] = [];
    const received2: EventReceived[] = [];

    const sub1 = client.subscribeToEvents({
      channel,
      group: '',
      onEvent: (msg) => received1.push(msg),
      onError: () => {},
    });
    const sub2 = client.subscribeToEvents({
      channel,
      group: '',
      onEvent: (msg) => received2.push(msg),
      onError: () => {},
    });
    await sleep(500);

    await client.sendEvent({ channel, body: new TextEncoder().encode('broadcast') });
    await sleep(1000);

    expect(received1.length).toBeGreaterThanOrEqual(1);
    expect(received2.length).toBeGreaterThanOrEqual(1);
    sub1.cancel();
    sub2.cancel();
  });
});
