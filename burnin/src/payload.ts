/**
 * Payload encoding/decoding with CRC32 integrity verification.
 */
import { randomBytes } from 'node:crypto';

// CRC32 IEEE lookup table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function crc32Hex(buf: Uint8Array): string {
  return crc32(buf).toString(16).padStart(8, '0');
}

export function verifyCrc(body: Uint8Array, expected: string): boolean {
  return crc32Hex(body) === expected;
}

export interface MessagePayload {
  sdk: string;
  pattern: string;
  producer_id: string;
  sequence: number;
  timestamp_ns: number;
  payload_padding?: string;
}

export function encode(
  sdk: string,
  pattern: string,
  producerId: string,
  seq: number,
  targetSize: number,
): { body: Uint8Array; crcHex: string } {
  const msg: Record<string, unknown> = {
    sdk,
    pattern,
    producer_id: producerId,
    sequence: seq,
    timestamp_ns: Number(process.hrtime.bigint()),
  };
  // Estimate base JSON size without serializing twice:
  // ~overhead for keys + fixed field values + producerId + seq digits
  const estimatedBase = 80 + sdk.length + pattern.length + producerId.length + String(seq).length;
  if (targetSize > estimatedBase + 20) {
    const padLen = targetSize - estimatedBase - 20;
    if (padLen > 0) msg.payload_padding = randomPadding(padLen);
  }
  const body = Buffer.from(JSON.stringify(msg));
  return { body, crcHex: crc32Hex(body) };
}

export function decode(body: Uint8Array): MessagePayload {
  const str = Buffer.from(body).toString('utf8');
  const d = JSON.parse(str) as Record<string, unknown>;
  return {
    sdk: String(d.sdk ?? ''),
    pattern: String(d.pattern ?? ''),
    producer_id: String(d.producer_id ?? ''),
    sequence: Number(d.sequence ?? 0),
    timestamp_ns: Number(d.timestamp_ns ?? 0),
    payload_padding: d.payload_padding as string | undefined,
  };
}

function randomPadding(n: number): string {
  // Use base64 encoding instead of per-char string allocations to reduce GC pressure
  const buf = randomBytes(Math.ceil((n * 3) / 4));
  return buf.toString('base64').slice(0, n);
}

export class SizeDistribution {
  private sizes: number[] = [];
  private weights: number[] = [];
  private total = 0;

  constructor(spec: string) {
    for (const pair of spec.split(',')) {
      const [s, w] = pair.trim().split(':');
      this.sizes.push(Number(s));
      this.weights.push(Number(w));
      this.total += Number(w);
    }
  }

  selectSize(): number {
    let r = Math.floor(Math.random() * this.total) + 1;
    for (let i = 0; i < this.sizes.length; i++) {
      r -= this.weights[i];
      if (r <= 0) return this.sizes[i];
    }
    return this.sizes.at(-1) ?? 1024;
  }
}
