import { describe, it, expect } from 'vitest';
import {
  stringToBytes,
  bytesToString,
  toBytes,
  toBuffer,
} from '../../src/internal/utils/encoding.js';

describe('stringToBytes / bytesToString', () => {
  it('round-trips an ASCII string', () => {
    const original = 'hello world';
    expect(bytesToString(stringToBytes(original))).toBe(original);
  });

  it('round-trips an empty string', () => {
    const bytes = stringToBytes('');
    expect(bytes.byteLength).toBe(0);
    expect(bytesToString(bytes)).toBe('');
  });

  it('round-trips unicode (emoji + CJK)', () => {
    const original = '日本語🎉';
    expect(bytesToString(stringToBytes(original))).toBe(original);
  });

  it('throws TypeError on invalid UTF-8 sequence', () => {
    const bad = new Uint8Array([0xff, 0xfe]);
    expect(() => bytesToString(bad)).toThrow(TypeError);
  });
});

describe('toBytes', () => {
  it('encodes a string to Uint8Array', () => {
    const result = toBytes('abc');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.byteLength).toBe(3);
  });

  it('returns Uint8Array input as-is', () => {
    const input = new Uint8Array([1, 2, 3]);
    expect(toBytes(input)).toBe(input);
  });
});

describe('toBuffer', () => {
  it('returns a Buffer that shares memory with the source Uint8Array', () => {
    const src = new Uint8Array([10, 20, 30]);
    const buf = toBuffer(src);

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBe(3);
    expect(buf[0]).toBe(10);

    src[0] = 99;
    expect(buf[0]).toBe(99);
  });
});
