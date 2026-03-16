import { describe, it, expect } from 'vitest';
import { createEventMessage } from '../../../src/messages/events.js';
import { ValidationError } from '../../../src/errors.js';

describe('createEventMessage', () => {
  const validOpts = {
    channel: 'events-channel',
    body: 'default-body',
  };

  it('creates event with all fields', () => {
    const evt = createEventMessage({
      channel: 'evt-channel',
      body: 'payload',
      metadata: 'meta',
      tags: { key: 'value' },
      id: 'my-id',
      clientId: 'client-1',
    });

    expect(evt.channel).toBe('evt-channel');
    expect(evt.body).toBeInstanceOf(Uint8Array);
    expect(evt.metadata).toBe('meta');
    expect(evt.tags).toEqual({ key: 'value' });
    expect(evt.id).toBe('my-id');
    expect(evt.clientId).toBe('client-1');
  });

  it('auto-generates id when not provided', () => {
    const evt = createEventMessage(validOpts);
    expect(evt.id).toBeDefined();
    expect(typeof evt.id).toBe('string');
    expect(evt.id!.length).toBeGreaterThan(0);

    const evt2 = createEventMessage(validOpts);
    expect(evt2.id).not.toBe(evt.id);
  });

  it('defaults metadata to empty string and tags to empty object', () => {
    const evt = createEventMessage(validOpts);
    expect(evt.metadata).toBe('');
    expect(evt.tags).toEqual({});
  });

  it('normalizes string body to Uint8Array', () => {
    const evt = createEventMessage({ ...validOpts, body: 'hello' });
    expect(evt.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(evt.body as Uint8Array)).toBe('hello');
  });

  it('normalizes Buffer body to Uint8Array', () => {
    const evt = createEventMessage({
      ...validOpts,
      body: Buffer.from('buffer-data'),
    });
    expect(evt.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(evt.body as Uint8Array)).toBe('buffer-data');
  });

  it('passes through Uint8Array body unchanged', () => {
    const raw = new TextEncoder().encode('raw-bytes');
    const evt = createEventMessage({ ...validOpts, body: raw });
    expect(evt.body).toBe(raw);
  });

  it('leaves body undefined when metadata is provided instead', () => {
    const evt = createEventMessage({ channel: 'events-channel', metadata: 'has-meta' });
    expect(evt.body).toBeUndefined();
  });

  it('freezes the returned object', () => {
    const evt = createEventMessage(validOpts);
    expect(Object.isFrozen(evt)).toBe(true);
    expect(() => {
      (evt as { channel: string }).channel = 'other';
    }).toThrow(TypeError);
  });

  it('throws ValidationError for empty channel', () => {
    expect(() => createEventMessage({ channel: '' })).toThrow(ValidationError);
    expect(() => createEventMessage({ channel: '   ' })).toThrow(ValidationError);
  });

  it('requires body, metadata, or tags (throws without)', () => {
    expect(() => createEventMessage({ channel: 'ch' })).toThrow();
  });
});
