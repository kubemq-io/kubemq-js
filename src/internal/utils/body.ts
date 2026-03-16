/** @internal */

import { stringToBytes, bytesToString as decodeBytesToString } from './encoding.js';

/**
 * Union type for message body inputs. Accepts string (auto-encoded to UTF-8),
 * Uint8Array, or Node.js Buffer (zero-copy view extracted).
 *
 * Public API methods and factory functions accept `MessageBody`;
 * internally the SDK normalizes to `Uint8Array` before sending to gRPC.
 */
export type MessageBody = string | Uint8Array | Buffer;

/**
 * Normalize any accepted body input to a `Uint8Array`.
 *
 * - `string` → UTF-8 encoded via cached `TextEncoder`
 * - `Buffer` → zero-copy `Uint8Array` view (no data copy)
 * - `Uint8Array` → returned as-is
 */
export function normalizeBody(body: MessageBody): Uint8Array {
  if (typeof body === 'string') {
    return stringToBytes(body);
  }
  if (Buffer.isBuffer(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  return body;
}

/**
 * Decode a `Uint8Array` body to a UTF-8 string.
 * Uses the cached `TextDecoder` singleton.
 */
export function bodyToString(body: Uint8Array): string {
  return decodeBytesToString(body);
}
