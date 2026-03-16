import { describe, it, expect } from 'vitest';
import { createEventStoreMessage, EventStoreType } from '../../../src/messages/events-store.js';
import { ValidationError } from '../../../src/errors.js';

describe('createEventStoreMessage', () => {
  const validOpts = {
    channel: 'store-channel',
    body: 'default-body',
  };

  it('creates message with all fields', () => {
    const msg = createEventStoreMessage({
      channel: 'store-channel',
      body: 'payload',
      metadata: 'meta',
      tags: { key: 'value' },
      id: 'my-id',
      clientId: 'client-1',
    });

    expect(msg.channel).toBe('store-channel');
    expect(msg.body).toBeInstanceOf(Uint8Array);
    expect(msg.metadata).toBe('meta');
    expect(msg.tags).toEqual({ key: 'value' });
    expect(msg.id).toBe('my-id');
    expect(msg.clientId).toBe('client-1');
  });

  it('auto-generates id when not provided', () => {
    const msg = createEventStoreMessage(validOpts);
    expect(msg.id).toBeDefined();
    expect(typeof msg.id).toBe('string');
    expect(msg.id!.length).toBeGreaterThan(0);

    const msg2 = createEventStoreMessage(validOpts);
    expect(msg2.id).not.toBe(msg.id);
  });

  it('defaults metadata to empty string and tags to empty object', () => {
    const msg = createEventStoreMessage(validOpts);
    expect(msg.metadata).toBe('');
    expect(msg.tags).toEqual({});
  });

  it('normalizes string body to Uint8Array', () => {
    const msg = createEventStoreMessage({ ...validOpts, body: 'hello' });
    expect(msg.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(msg.body as Uint8Array)).toBe('hello');
  });

  it('normalizes Buffer body to Uint8Array', () => {
    const msg = createEventStoreMessage({
      ...validOpts,
      body: Buffer.from('buffer-data'),
    });
    expect(msg.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(msg.body as Uint8Array)).toBe('buffer-data');
  });

  it('freezes the returned object', () => {
    const msg = createEventStoreMessage(validOpts);
    expect(Object.isFrozen(msg)).toBe(true);
    expect(() => {
      (msg as { channel: string }).channel = 'other';
    }).toThrow(TypeError);
  });

  it('throws ValidationError for empty channel', () => {
    expect(() => createEventStoreMessage({ channel: '' })).toThrow(ValidationError);
    expect(() => createEventStoreMessage({ channel: '   ' })).toThrow(ValidationError);
  });

  it('preserves custom id when provided', () => {
    const msg = createEventStoreMessage({ ...validOpts, id: 'custom-id-123' });
    expect(msg.id).toBe('custom-id-123');
  });
});

describe('EventStoreType', () => {
  it('has correct enum values', () => {
    expect(EventStoreType.StartNewOnly).toBe(1);
    expect(EventStoreType.StartFromFirst).toBe(2);
    expect(EventStoreType.StartFromLast).toBe(3);
    expect(EventStoreType.StartAtSequence).toBe(4);
    expect(EventStoreType.StartAtTime).toBe(5);
    expect(EventStoreType.StartAtTimeDelta).toBe(6);
  });
});
