import { describe, it, expect } from 'vitest';
import { normalizeBody, bodyToString } from '../../src/internal/utils/body.js';

describe('normalizeBody', () => {
  it('encodes a string to Uint8Array', () => {
    const result = normalizeBody('hello');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.byteLength).toBe(5);
  });

  it('returns Uint8Array input as-is (pass-through)', () => {
    const input = new Uint8Array([1, 2, 3]);
    expect(normalizeBody(input)).toBe(input);
  });

  it('extracts a zero-copy Uint8Array view from a Buffer', () => {
    const buf = Buffer.from([10, 20, 30]);
    const result = normalizeBody(buf);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.byteLength).toBe(3);

    buf[0] = 99;
    expect(result[0]).toBe(99);
  });
});

describe('bodyToString', () => {
  it('decodes Uint8Array back to string (round-trip)', () => {
    const original = 'kubemq message 🚀';
    const bytes = normalizeBody(original);
    expect(bodyToString(bytes)).toBe(original);
  });
});
