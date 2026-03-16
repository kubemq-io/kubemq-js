/**
 * UUID generation using Node.js built-in `crypto.randomUUID()`.
 * Eliminates the `uuid` npm package dependency (JS-50).
 *
 * Available globally since Node.js 19 via `globalThis.crypto`.
 * The SDK targets Node.js ≥20, so this is always available.
 *
 * @internal
 */

import { randomUUID } from 'node:crypto';

/**
 * Generate a cryptographically random UUID v4 string.
 */
export function generateId(): string {
  return randomUUID();
}
