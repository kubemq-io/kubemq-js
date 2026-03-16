/**
 * @internal — Auth credential injection for gRPC calls.
 *
 * Two mechanisms are provided:
 * 1. Call credentials (combined with SSL channel credentials via
 *    grpc.credentials.combineChannelCredentials) — used when TLS is enabled.
 * 2. Interceptor-based token injection — used for insecure connections
 *    where combineChannelCredentials is not available.
 */

import type { TokenCache } from '../../auth/token-cache.js';
import type { Logger } from '../../logger.js';

// ─── Metadata Keys ──────────────────────────────────────────────────

export const AUTH_METADATA_KEY = 'authorization';

/**
 * Metadata keys that must be redacted from logs, OTel spans, and toString.
 */
export const REDACTED_METADATA_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]);

/**
 * Sanitize gRPC metadata for safe logging / OTel span attributes.
 * Replaces sensitive header values with '[REDACTED]'.
 */
export function sanitizeMetadata(metadata: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (REDACTED_METADATA_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Fetch a token from the cache and return it with metadata
 * suitable for gRPC call injection. Returns undefined if
 * the token fetch fails (non-throwing for interceptor use).
 */
export async function fetchTokenForMetadata(
  tokenCache: TokenCache,
  logger: Logger,
): Promise<string | undefined> {
  try {
    const token = await tokenCache.getToken();
    logger.debug('Token injected into gRPC metadata', {
      tokenPresent: true,
      tokenLength: token.length,
    });
    return token;
  } catch (err: unknown) {
    logger.warn('Credential provider failed — request will proceed without token', {
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Security warnings emitted on every connection/reconnection attempt.
 */
export function emitSecurityWarnings(
  opts: {
    insecureSkipVerify?: boolean;
    tlsEnabled: boolean;
    address: string;
  },
  isLocalhost: boolean,
  logger: Logger,
): void {
  if (opts.insecureSkipVerify) {
    logger.warn('certificate verification is disabled — this connection is insecure', {
      address: opts.address,
      insecureSkipVerify: true,
    });
  }

  if (!opts.tlsEnabled && !isLocalhost) {
    logger.warn('TLS is disabled for a remote address — connection is unencrypted', {
      address: opts.address,
      tlsEnabled: false,
    });
  }
}
