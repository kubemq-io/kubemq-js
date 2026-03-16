/**
 * Cached TextEncoder/TextDecoder singletons for efficient string↔bytes
 * conversion. Both are stateless when used without streaming, so
 * module-level reuse is safe across concurrent async operations.
 *
 * @internal
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * Encode a string to UTF-8 bytes using the cached TextEncoder.
 */
export function stringToBytes(str: string): Uint8Array {
  return encoder.encode(str);
}

/**
 * Decode UTF-8 bytes to a string using the cached TextDecoder.
 * Throws `TypeError` on invalid UTF-8 sequences (fail-fast).
 */
export function bytesToString(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/**
 * Normalize input to `Uint8Array`. Zero-copy when input is already
 * `Uint8Array`; encodes via cached TextEncoder when input is a string.
 */
export function toBytes(input: Uint8Array | string): Uint8Array {
  if (typeof input === 'string') {
    return encoder.encode(input);
  }
  return input;
}

/**
 * Create a zero-copy `Buffer` view over a `Uint8Array`.
 * Use when gRPC or protobuf APIs require `Buffer`.
 *
 * @remarks
 * `Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength)` shares
 * the underlying ArrayBuffer — no data copy.
 */
export function toBuffer(data: Uint8Array): Buffer {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
