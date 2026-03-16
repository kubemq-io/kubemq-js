import { bench, describe } from 'vitest';
import { stringToBytes, bytesToString, toBytes, toBuffer } from '../src/internal/utils/encoding.js';

describe('Serialization — stringToBytes / bytesToString', () => {
  const shortString = 'Hello, KubeMQ!';
  const unicodeString = 'Hello, 世界! 🌍 こんにちは';
  const largeString = 'x'.repeat(100_000);
  const shortBytes = stringToBytes(shortString);
  const largeBytes = stringToBytes(largeString);

  bench('stringToBytes — short string', () => {
    stringToBytes(shortString);
  });

  bench('stringToBytes — unicode string', () => {
    stringToBytes(unicodeString);
  });

  bench('stringToBytes — 100KB string', () => {
    stringToBytes(largeString);
  });

  bench('bytesToString — short bytes', () => {
    bytesToString(shortBytes);
  });

  bench('bytesToString — 100KB bytes', () => {
    bytesToString(largeBytes);
  });

  bench('toBytes — passthrough Uint8Array (zero-copy)', () => {
    toBytes(shortBytes);
  });

  bench('toBytes — string encoding', () => {
    toBytes(shortString);
  });

  bench('toBuffer — zero-copy view', () => {
    toBuffer(shortBytes);
  });
});
