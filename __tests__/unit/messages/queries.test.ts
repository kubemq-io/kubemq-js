import { describe, it, expect } from 'vitest';
import { createQuery } from '../../../src/messages/queries.js';
import { ValidationError } from '../../../src/errors.js';

describe('createQuery', () => {
  const validOpts = {
    channel: 'query-channel',
    body: 'hello',
    timeoutInSeconds: 5,
  };

  it('creates query with all fields including cache', () => {
    const q = createQuery({
      channel: 'q-channel',
      body: 'payload',
      metadata: 'meta',
      tags: { key: 'value' },
      timeoutInSeconds: 3,
      cacheKey: 'my-cache-key',
      cacheTtlInSeconds: 60,
      id: 'my-id',
      clientId: 'client-1',
    });

    expect(q.channel).toBe('q-channel');
    expect(q.body).toBeInstanceOf(Uint8Array);
    expect(q.metadata).toBe('meta');
    expect(q.tags).toEqual({ key: 'value' });
    expect(q.timeoutInSeconds).toBe(3);
    expect(q.cacheKey).toBe('my-cache-key');
    expect(q.cacheTtlInSeconds).toBe(60);
    expect(q.id).toBe('my-id');
    expect(q.clientId).toBe('client-1');
  });

  it('auto-generates id when not provided', () => {
    const q = createQuery(validOpts);
    expect(q.id).toBeDefined();
    expect(typeof q.id).toBe('string');
    expect(q.id!.length).toBeGreaterThan(0);

    const q2 = createQuery(validOpts);
    expect(q2.id).not.toBe(q.id);
  });

  it('defaults metadata to empty string and tags to empty object', () => {
    const q = createQuery(validOpts);
    expect(q.metadata).toBe('');
    expect(q.tags).toEqual({});
  });

  it('preserves cacheKey and cacheTtlInSeconds', () => {
    const q = createQuery({
      ...validOpts,
      cacheKey: 'ck',
      cacheTtlInSeconds: 120,
    });
    expect(q.cacheKey).toBe('ck');
    expect(q.cacheTtlInSeconds).toBe(120);
  });

  it('leaves cache fields undefined when not provided', () => {
    const q = createQuery(validOpts);
    expect(q.cacheKey).toBeUndefined();
    expect(q.cacheTtlInSeconds).toBeUndefined();
  });

  it('normalizes string body to Uint8Array', () => {
    const q = createQuery(validOpts);
    expect(q.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(q.body as Uint8Array)).toBe('hello');
  });

  it('normalizes Buffer body to Uint8Array', () => {
    const q = createQuery({
      ...validOpts,
      body: Buffer.from('buffer-data'),
    });
    expect(q.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(q.body as Uint8Array)).toBe('buffer-data');
  });

  it('passes through Uint8Array body unchanged', () => {
    const raw = new TextEncoder().encode('raw-bytes');
    const q = createQuery({ ...validOpts, body: raw });
    expect(q.body).toBe(raw);
  });

  it('freezes the returned object', () => {
    const q = createQuery(validOpts);
    expect(Object.isFrozen(q)).toBe(true);
    expect(() => {
      (q as { channel: string }).channel = 'other';
    }).toThrow(TypeError);
  });

  it('throws ValidationError for empty channel', () => {
    expect(() => createQuery({ ...validOpts, channel: '' })).toThrow(ValidationError);
    expect(() => createQuery({ ...validOpts, channel: '   ' })).toThrow(ValidationError);
  });

  it('throws ValidationError when no body, metadata, or tags', () => {
    expect(() =>
      createQuery({
        channel: 'ch',
        timeoutInSeconds: 1,
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when timeoutInSeconds <= 0', () => {
    expect(() => createQuery({ ...validOpts, timeoutInSeconds: 0 })).toThrow(ValidationError);
    expect(() => createQuery({ ...validOpts, timeoutInSeconds: -1 })).toThrow(ValidationError);
  });

  it('throws ValidationError when cacheTtlInSeconds <= 0', () => {
    expect(() => createQuery({ ...validOpts, cacheTtlInSeconds: 0 })).toThrow(ValidationError);
    expect(() => createQuery({ ...validOpts, cacheTtlInSeconds: -5 })).toThrow(ValidationError);
  });

  it('accepts metadata alone without body', () => {
    const q = createQuery({
      channel: 'ch',
      metadata: 'some-meta',
      timeoutInSeconds: 1,
    });
    expect(q.body).toBeUndefined();
    expect(q.metadata).toBe('some-meta');
  });

  it('accepts tags alone without body or metadata', () => {
    const q = createQuery({
      channel: 'ch',
      tags: { env: 'test' },
      timeoutInSeconds: 1,
    });
    expect(q.body).toBeUndefined();
    expect(q.tags).toEqual({ env: 'test' });
  });
});
