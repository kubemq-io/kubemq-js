/**
 * Async TLS certificate loading — replaces `fs.readFileSync` with
 * `fs.promises.readFile` for non-blocking startup.
 *
 * Supports three input forms:
 * - `Buffer` — used directly (e.g. inline cert content)
 * - PEM string (starts with `-----BEGIN`) — converted to Buffer without I/O
 * - File path string — read asynchronously via `readFile`
 *
 * All certs load concurrently via `Promise.all` when multiple are configured.
 *
 * @internal
 */

import { readFile } from 'node:fs/promises';
import { normalize } from 'node:path';
import type { TlsOptions } from '../../options.js';
import { ConfigurationError, ErrorCode } from '../../errors.js';

export interface ResolvedTlsCredentials {
  rootCerts: Buffer | null;
  clientCert: Buffer | null;
  clientKey: Buffer | null;
}

/**
 * Load TLS credentials asynchronously. All configured certs load
 * in parallel for minimum startup latency.
 */
export async function loadTlsCredentials(tls: TlsOptions): Promise<ResolvedTlsCredentials> {
  const [rootCerts, clientCert, clientKey] = await Promise.all([
    tls.caCert ? loadPemOrFile(tls.caCert) : Promise.resolve(null),
    tls.clientCert ? loadPemOrFile(tls.clientCert) : Promise.resolve(null),
    tls.clientKey ? loadPemOrFile(tls.clientKey) : Promise.resolve(null),
  ]);

  return { rootCerts, clientCert, clientKey };
}

/**
 * Resolve a cert input to a Buffer:
 * - Buffer → returned as-is
 * - PEM string (-----BEGIN ...) → converted to Buffer (no I/O)
 * - File path → read asynchronously
 */
async function loadPemOrFile(input: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  if (typeof input === 'string' && input.startsWith('-----BEGIN')) {
    return Buffer.from(input, 'utf-8');
  }
  const normalized = normalize(input);
  if (normalized.includes('..')) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `TLS file path must not contain path traversal segments: ${input}`,
      operation: 'loadPemOrFile',
      isRetryable: false,
      suggestion: 'Use an absolute path or a relative path without ".." segments.',
    });
  }
  return readFile(input);
}
