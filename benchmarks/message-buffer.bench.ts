import { bench, describe } from 'vitest';
import { stringToBytes, toBytes, toBuffer } from '../src/internal/utils/encoding.js';
import { normalizeBody } from '../src/internal/utils/body.js';

describe('Message buffer throughput', () => {
  const payload64B = new Uint8Array(64).fill(65);
  const payload1KB = new Uint8Array(1024).fill(65);
  const payload64KB = new Uint8Array(65_536).fill(65);
  const stringPayload = 'A'.repeat(1024);
  const nodeBuffer = Buffer.alloc(1024, 65);

  bench('normalizeBody — Uint8Array passthrough (64B)', () => {
    normalizeBody(payload64B);
  });

  bench('normalizeBody — Uint8Array passthrough (1KB)', () => {
    normalizeBody(payload1KB);
  });

  bench('normalizeBody — Uint8Array passthrough (64KB)', () => {
    normalizeBody(payload64KB);
  });

  bench('normalizeBody — string encoding (1KB)', () => {
    normalizeBody(stringPayload);
  });

  bench('normalizeBody — Buffer zero-copy (1KB)', () => {
    normalizeBody(nodeBuffer);
  });

  bench('toBuffer — zero-copy view (1KB)', () => {
    toBuffer(payload1KB);
  });

  bench('toBytes — string (1KB)', () => {
    toBytes(stringPayload);
  });

  bench('toBytes — Uint8Array passthrough (1KB)', () => {
    toBytes(payload1KB);
  });

  bench('stringToBytes + toBuffer roundtrip (1KB)', () => {
    toBuffer(stringToBytes(stringPayload));
  });
});
