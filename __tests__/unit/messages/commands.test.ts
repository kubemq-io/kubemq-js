import { describe, it, expect } from 'vitest';
import { createCommand } from '../../../src/messages/commands.js';
import { ValidationError } from '../../../src/errors.js';

describe('createCommand', () => {
  const validOpts = {
    channel: 'test-channel',
    body: 'hello',
    timeoutMs: 5000,
  };

  it('creates command with all fields', () => {
    const cmd = createCommand({
      channel: 'cmd-channel',
      body: 'payload',
      metadata: 'meta',
      tags: { key: 'value' },
      timeoutMs: 3000,
      id: 'my-id',
      clientId: 'client-1',
    });

    expect(cmd.channel).toBe('cmd-channel');
    expect(cmd.body).toBeInstanceOf(Uint8Array);
    expect(cmd.metadata).toBe('meta');
    expect(cmd.tags).toEqual({ key: 'value' });
    expect(cmd.timeoutMs).toBe(3000);
    expect(cmd.id).toBe('my-id');
    expect(cmd.clientId).toBe('client-1');
  });

  it('auto-generates id when not provided', () => {
    const cmd = createCommand(validOpts);
    expect(cmd.id).toBeDefined();
    expect(typeof cmd.id).toBe('string');
    expect(cmd.id!.length).toBeGreaterThan(0);

    const cmd2 = createCommand(validOpts);
    expect(cmd2.id).not.toBe(cmd.id);
  });

  it('defaults metadata to empty string and tags to empty object', () => {
    const cmd = createCommand(validOpts);
    expect(cmd.metadata).toBe('');
    expect(cmd.tags).toEqual({});
  });

  it('normalizes string body to Uint8Array', () => {
    const cmd = createCommand(validOpts);
    expect(cmd.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(cmd.body as Uint8Array)).toBe('hello');
  });

  it('normalizes Buffer body to Uint8Array', () => {
    const cmd = createCommand({
      ...validOpts,
      body: Buffer.from('buffer-data'),
    });
    expect(cmd.body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(cmd.body as Uint8Array)).toBe('buffer-data');
  });

  it('passes through Uint8Array body unchanged', () => {
    const raw = new TextEncoder().encode('raw-bytes');
    const cmd = createCommand({ ...validOpts, body: raw });
    expect(cmd.body).toBe(raw);
  });

  it('freezes the returned object', () => {
    const cmd = createCommand(validOpts);
    expect(Object.isFrozen(cmd)).toBe(true);
    expect(() => {
      (cmd as { channel: string }).channel = 'other';
    }).toThrow(TypeError);
  });

  it('throws ValidationError for empty channel', () => {
    expect(() => createCommand({ ...validOpts, channel: '' })).toThrow(ValidationError);
    expect(() => createCommand({ ...validOpts, channel: '   ' })).toThrow(ValidationError);
  });

  it('throws ValidationError when no body, metadata, or tags', () => {
    expect(() =>
      createCommand({
        channel: 'ch',
        timeoutMs: 1000,
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when timeoutMs <= 0', () => {
    expect(() => createCommand({ ...validOpts, timeoutMs: 0 })).toThrow(ValidationError);
    expect(() => createCommand({ ...validOpts, timeoutMs: -1 })).toThrow(ValidationError);
  });

  it('accepts metadata alone without body', () => {
    const cmd = createCommand({
      channel: 'ch',
      metadata: 'some-meta',
      timeoutMs: 1000,
    });
    expect(cmd.body).toBeUndefined();
    expect(cmd.metadata).toBe('some-meta');
  });

  it('accepts tags alone without body or metadata', () => {
    const cmd = createCommand({
      channel: 'ch',
      tags: { env: 'test' },
      timeoutMs: 1000,
    });
    expect(cmd.body).toBeUndefined();
    expect(cmd.tags).toEqual({ env: 'test' });
  });
});
