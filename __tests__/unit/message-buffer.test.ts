import { describe, it, expect } from 'vitest';
import { MessageBuffer } from '../../src/internal/transport/message-buffer.js';
import { BufferFullError } from '../../src/errors.js';
import { createTestLogger } from '../fixtures/test-helpers.js';

function makeBufferedMessage(size: number, channel = 'ch') {
  return {
    data: new Uint8Array(size),
    operation: 'send',
    channel,
    resolve: () => {},
    reject: () => {},
    bufferedAt: Date.now(),
  };
}

describe('MessageBuffer', () => {
  it('starts empty', () => {
    const buf = new MessageBuffer(1024, 'error', createTestLogger());
    expect(buf.size).toBe(0);
    expect(buf.sizeBytes).toBe(0);
  });

  it('enqueues messages within capacity', async () => {
    const buf = new MessageBuffer(1024, 'error', createTestLogger());
    await buf.enqueue(makeBufferedMessage(100));
    expect(buf.size).toBe(1);
    expect(buf.sizeBytes).toBe(100);
  });

  it('throws BufferFullError in error mode when exceeding capacity', async () => {
    const buf = new MessageBuffer(100, 'error', createTestLogger());
    await buf.enqueue(makeBufferedMessage(60));

    try {
      await buf.enqueue(makeBufferedMessage(60));
      expect.unreachable('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(BufferFullError);
    }
  });

  it('flush sends all messages and clears the buffer', async () => {
    const logger = createTestLogger();
    const buf = new MessageBuffer(1024, 'error', logger);
    await buf.enqueue(makeBufferedMessage(10, 'ch1'));
    await buf.enqueue(makeBufferedMessage(20, 'ch2'));

    const sent: string[] = [];
    const count = await buf.flush(async (msg) => {
      sent.push(msg.channel);
    });

    expect(count).toBe(2);
    expect(sent).toEqual(['ch1', 'ch2']);
    expect(buf.size).toBe(0);
    expect(buf.sizeBytes).toBe(0);
  });

  it('flush rejects messages that fail to send', async () => {
    const buf = new MessageBuffer(1024, 'error', createTestLogger());
    const rejected: unknown[] = [];
    await buf.enqueue({
      ...makeBufferedMessage(10),
      reject: (err: unknown) => rejected.push(err),
    });

    await buf.flush(async () => {
      throw new Error('send failed');
    });

    expect(rejected).toHaveLength(1);
  });

  it('discard rejects all buffered messages', async () => {
    const buf = new MessageBuffer(1024, 'error', createTestLogger());
    const rejected: unknown[] = [];
    await buf.enqueue({
      ...makeBufferedMessage(10),
      reject: (reason: unknown) => rejected.push(reason),
    });
    await buf.enqueue({
      ...makeBufferedMessage(10),
      reject: (reason: unknown) => rejected.push(reason),
    });

    const discarded = buf.discard();
    expect(discarded).toBe(2);
    expect(rejected).toHaveLength(2);
    expect(buf.size).toBe(0);
  });

  it('enqueue in block mode blocks when full and resumes after flush', async () => {
    const buf = new MessageBuffer(50, 'block', createTestLogger());
    await buf.enqueue(makeBufferedMessage(40, 'first'));

    let secondEnqueued = false;
    const enqueuePromise = buf.enqueue(makeBufferedMessage(40, 'second')).then(() => {
      secondEnqueued = true;
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(secondEnqueued).toBe(false);

    await buf.flush(async () => {});

    await enqueuePromise;
    expect(secondEnqueued).toBe(true);
    expect(buf.size).toBe(1);
  });

  it('flush returns 0 and resolves drain waiters when sendFn throws for every message', async () => {
    const buf = new MessageBuffer(1024, 'error', createTestLogger());
    const rejected: unknown[] = [];
    await buf.enqueue({
      ...makeBufferedMessage(10, 'fail-ch'),
      reject: (err: unknown) => rejected.push(err),
    });

    const count = await buf.flush(async () => {
      throw new Error('network error');
    });

    expect(count).toBe(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toBeInstanceOf(Error);
    expect(buf.size).toBe(0);
  });

  it('rejectAll rejects all waiting blockers', async () => {
    const buf = new MessageBuffer(50, 'block', createTestLogger());
    await buf.enqueue(makeBufferedMessage(40));

    const errors: unknown[] = [];
    const p1 = buf.enqueue(makeBufferedMessage(40, 'blocked-1')).catch((e) => errors.push(e));
    const p2 = buf.enqueue(makeBufferedMessage(40, 'blocked-2')).catch((e) => errors.push(e));

    await new Promise((r) => setTimeout(r, 20));

    buf.rejectAll(new Error('connection lost'));

    await Promise.allSettled([p1, p2]);
    expect(errors).toHaveLength(2);
    expect(errors.every((e) => e instanceof Error && e.message === 'connection lost')).toBe(true);
  });

  it('discard rejects buffered messages and waiting blockers', async () => {
    const buf = new MessageBuffer(50, 'block', createTestLogger());
    const msgRejected: unknown[] = [];
    const blockerErrors: unknown[] = [];

    await buf.enqueue({
      ...makeBufferedMessage(40, 'buffered'),
      reject: (r: unknown) => msgRejected.push(r),
    });

    const blockerPromise = buf
      .enqueue(makeBufferedMessage(40, 'blocked'))
      .catch((e) => blockerErrors.push(e));

    await new Promise((r) => setTimeout(r, 20));

    const discarded = buf.discard();
    expect(discarded).toBe(1);

    await Promise.allSettled([blockerPromise]);
    expect(msgRejected).toHaveLength(1);
    expect(msgRejected[0]).toBeInstanceOf(BufferFullError);
    expect(blockerErrors).toHaveLength(1);
    expect(blockerErrors[0]).toBeInstanceOf(BufferFullError);
    expect(buf.size).toBe(0);
    expect(buf.sizeBytes).toBe(0);
  });

  it('flush resolves blocked enqueue so the message eventually lands in the buffer', async () => {
    const buf = new MessageBuffer(100, 'block', createTestLogger());
    await buf.enqueue(makeBufferedMessage(80, 'first'));

    const enqueuePromise = buf.enqueue(makeBufferedMessage(80, 'second'));

    await new Promise((r) => setTimeout(r, 10));

    const sent: string[] = [];
    await buf.flush(async (msg) => {
      sent.push(msg.channel);
    });
    await enqueuePromise;

    expect(sent).toContain('first');
    expect(buf.size).toBe(1);
  });

  it('discard returns 0 for an empty buffer', () => {
    const buf = new MessageBuffer(1024, 'error', createTestLogger());
    expect(buf.discard()).toBe(0);
  });

  it('flush on empty buffer returns 0', async () => {
    const buf = new MessageBuffer(1024, 'error', createTestLogger());
    const count = await buf.flush(async () => {});
    expect(count).toBe(0);
  });
});
