import { describe, it, expect } from 'vitest';
import { createQueueMessage } from '../../../src/messages/queues.js';
import { ValidationError } from '../../../src/errors.js';

describe('createQueueMessage', () => {
  const validOpts = {
    channel: 'queue-channel',
    body: 'hello',
  };

  it('creates queue message with all fields', () => {
    const msg = createQueueMessage({
      channel: 'q-channel',
      body: 'payload',
      metadata: 'meta',
      tags: { key: 'value' },
      policy: {
        delaySeconds: 10,
        expirationSeconds: 300,
        maxReceiveCount: 3,
        maxReceiveQueue: 'dlq',
      },
      id: 'my-id',
      clientId: 'client-1',
    });

    expect(msg.channel).toBe('q-channel');
    expect(msg.body).toBeInstanceOf(Uint8Array);
    expect(msg.metadata).toBe('meta');
    expect(msg.tags).toEqual({ key: 'value' });
    expect(msg.policy).toEqual({
      delaySeconds: 10,
      expirationSeconds: 300,
      maxReceiveCount: 3,
      maxReceiveQueue: 'dlq',
    });
    expect(msg.id).toBe('my-id');
    expect(msg.clientId).toBe('client-1');
  });

  it('auto-generates id when not provided', () => {
    const msg = createQueueMessage(validOpts);
    expect(msg.id).toBeDefined();
    expect(typeof msg.id).toBe('string');
    expect(msg.id!.length).toBeGreaterThan(0);

    const msg2 = createQueueMessage(validOpts);
    expect(msg2.id).not.toBe(msg.id);
  });

  it('defaults metadata to empty string and tags to empty object', () => {
    const msg = createQueueMessage(validOpts);
    expect(msg.metadata).toBe('');
    expect(msg.tags).toEqual({});
  });

  it('leaves policy undefined when not provided', () => {
    const msg = createQueueMessage(validOpts);
    expect(msg.policy).toBeUndefined();
  });

  it('freezes the returned message object', () => {
    const msg = createQueueMessage(validOpts);
    expect(Object.isFrozen(msg)).toBe(true);
    expect(() => {
      (msg as { channel: string }).channel = 'other';
    }).toThrow(TypeError);
  });

  it('freezes the nested policy object separately', () => {
    const msg = createQueueMessage({
      ...validOpts,
      policy: {
        delaySeconds: 5,
        maxReceiveCount: 2,
        maxReceiveQueue: 'dlq',
      },
    });
    expect(Object.isFrozen(msg.policy)).toBe(true);
    expect(() => {
      (msg.policy as { delaySeconds: number }).delaySeconds = 99;
    }).toThrow(TypeError);
  });

  it('normalizes string body to Uint8Array', () => {
    const msg = createQueueMessage(validOpts);
    expect(msg.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(msg.body as Uint8Array)).toBe('hello');
  });

  it('normalizes Buffer body to Uint8Array', () => {
    const msg = createQueueMessage({
      ...validOpts,
      body: Buffer.from('buffer-data'),
    });
    expect(msg.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(msg.body as Uint8Array)).toBe('buffer-data');
  });

  it('passes through Uint8Array body unchanged', () => {
    const raw = new TextEncoder().encode('raw-bytes');
    const msg = createQueueMessage({ ...validOpts, body: raw });
    expect(msg.body).toBe(raw);
  });

  it('leaves body undefined when metadata is provided instead', () => {
    const msg = createQueueMessage({ channel: 'ch', metadata: 'has-meta' });
    expect(msg.body).toBeUndefined();
  });

  it('throws ValidationError for empty channel', () => {
    expect(() => createQueueMessage({ ...validOpts, channel: '' })).toThrow(ValidationError);
    expect(() => createQueueMessage({ ...validOpts, channel: '   ' })).toThrow(ValidationError);
  });

  it('throws ValidationError for negative policy.delaySeconds', () => {
    expect(() =>
      createQueueMessage({
        ...validOpts,
        policy: { delaySeconds: -1 },
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError for negative policy.expirationSeconds', () => {
    expect(() =>
      createQueueMessage({
        ...validOpts,
        policy: { expirationSeconds: -1 },
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError for negative policy.maxReceiveCount', () => {
    expect(() =>
      createQueueMessage({
        ...validOpts,
        policy: { maxReceiveCount: -1 },
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when maxReceiveCount > 0 without maxReceiveQueue', () => {
    expect(() =>
      createQueueMessage({
        ...validOpts,
        policy: { maxReceiveCount: 3 },
      }),
    ).toThrow(ValidationError);

    expect(() =>
      createQueueMessage({
        ...validOpts,
        policy: { maxReceiveCount: 3, maxReceiveQueue: '' },
      }),
    ).toThrow(ValidationError);

    expect(() =>
      createQueueMessage({
        ...validOpts,
        policy: { maxReceiveCount: 3, maxReceiveQueue: '   ' },
      }),
    ).toThrow(ValidationError);
  });

  it('allows maxReceiveCount > 0 with a valid maxReceiveQueue', () => {
    const msg = createQueueMessage({
      ...validOpts,
      policy: { maxReceiveCount: 3, maxReceiveQueue: 'dlq' },
    });
    expect(msg.policy!.maxReceiveCount).toBe(3);
    expect(msg.policy!.maxReceiveQueue).toBe('dlq');
  });

  it('allows policy with zero values', () => {
    const msg = createQueueMessage({
      ...validOpts,
      policy: { delaySeconds: 0, expirationSeconds: 0, maxReceiveCount: 0 },
    });
    expect(msg.policy!.delaySeconds).toBe(0);
    expect(msg.policy!.expirationSeconds).toBe(0);
    expect(msg.policy!.maxReceiveCount).toBe(0);
  });

  it('does not mutate the original policy object', () => {
    const policy = { delaySeconds: 5 };
    const msg = createQueueMessage({ ...validOpts, policy });
    policy.delaySeconds = 999;
    expect(msg.policy!.delaySeconds).toBe(5);
  });
});
