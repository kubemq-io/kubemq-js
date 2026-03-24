import { describe, it, expect, afterEach } from 'vitest';
import { KubeMQClient } from '../../src/client.js';
import { createTestClientOptions, uniqueChannel } from '../fixtures/test-helpers.js';
import { EventStoreStartPosition } from '../../src/messages/events-store.js';
import type { EventStoreReceived } from '../../src/messages/events-store.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  });
}

describe('Events Store integration', () => {
  let client: KubeMQClient;

  afterEach(async () => {
    if (client) await client.close().catch(() => {});
  });

  it('publishes and receives events store message', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('es-pubsub');
    const received: EventStoreReceived[] = [];

    const sub = client.subscribeToEventsStore({
      channel,
      group: '',
      startFrom: EventStoreStartPosition.StartFromNew,
      onEvent: (msg) => received.push(msg),
      onError: () => {},
    });
    await sleep(500);

    await client.sendEventStore({ channel, body: new TextEncoder().encode('store-msg') });
    await sleep(1000);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(new TextDecoder().decode(received[0].body)).toBe('store-msg');
    expect(received[0].sequence).toBeGreaterThan(0);
    sub.cancel();
  });

  it('subscribe with StartFromFirst receives all historical events', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('es-first');

    await client.sendEventStore({ channel, body: new TextEncoder().encode('msg-1') });
    await client.sendEventStore({ channel, body: new TextEncoder().encode('msg-2') });
    await sleep(500);

    const received: EventStoreReceived[] = [];
    const sub = client.subscribeToEventsStore({
      channel,
      group: '',
      startFrom: EventStoreStartPosition.StartFromFirst,
      onEvent: (msg) => received.push(msg),
      onError: () => {},
    });
    await sleep(1500);

    expect(received.length).toBeGreaterThanOrEqual(2);
    expect(new TextDecoder().decode(received[0].body)).toBe('msg-1');
    expect(new TextDecoder().decode(received[1].body)).toBe('msg-2');
    sub.cancel();
  });

  it('subscribe with StartFromNew receives only new events', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('es-new');

    await client.sendEventStore({ channel, body: new TextEncoder().encode('old-msg') });
    await sleep(500);

    const received: EventStoreReceived[] = [];
    const sub = client.subscribeToEventsStore({
      channel,
      group: '',
      startFrom: EventStoreStartPosition.StartFromNew,
      onEvent: (msg) => received.push(msg),
      onError: () => {},
    });
    await sleep(500);

    await client.sendEventStore({ channel, body: new TextEncoder().encode('new-msg') });
    await sleep(1000);

    expect(received.length).toBe(1);
    expect(new TextDecoder().decode(received[0].body)).toBe('new-msg');
    sub.cancel();
  });

  it('events store preserves order', async () => {
    client = await KubeMQClient.create(createTestClientOptions());
    const channel = uniqueChannel('es-order');
    const count = 5;

    for (let i = 0; i < count; i++) {
      await client.sendEventStore({
        channel,
        body: new TextEncoder().encode(`order-${i}`),
      });
    }
    await sleep(500);

    const received: EventStoreReceived[] = [];
    const sub = client.subscribeToEventsStore({
      channel,
      group: '',
      startFrom: EventStoreStartPosition.StartFromFirst,
      onEvent: (msg) => received.push(msg),
      onError: () => {},
    });
    await sleep(2000);

    expect(received.length).toBe(count);
    for (let i = 0; i < count; i++) {
      expect(new TextDecoder().decode(received[i].body)).toBe(`order-${i}`);
    }
    for (let i = 1; i < count; i++) {
      expect(received[i].sequence).toBeGreaterThan(received[i - 1].sequence);
    }
    sub.cancel();
  });
});
