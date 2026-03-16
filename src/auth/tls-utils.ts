import { readFile } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';
import type { TlsOptions } from '../options.js';
import type { Logger } from '../logger.js';
import { AuthenticationError, ConfigurationError, ErrorCode } from '../errors.js';

// ─── PEM Resolution ──────────────────────────────────────────────────

/**
 * Resolve a cert/key input to a Buffer.
 * - Buffer → passthrough
 * - String starting with "-----BEGIN" → treat as inline PEM
 * - Otherwise → treat as file path and read from disk
 */
export async function resolvePemOrPath(input: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  if (input.trimStart().startsWith('-----BEGIN')) {
    return Buffer.from(input, 'utf-8');
  }
  return readFile(input);
}

// ─── Localhost Detection ─────────────────────────────────────────────

const LOCALHOST_PATTERNS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLocalhostAddress(address: string): boolean {
  const host = extractHost(address);
  return LOCALHOST_PATTERNS.has(host.toLowerCase());
}

function extractHost(address: string): string {
  if (address.startsWith('[')) {
    const closingBracket = address.indexOf(']');
    return closingBracket > 0 ? address.slice(0, closingBracket + 1) : address;
  }
  const lastColon = address.lastIndexOf(':');
  return lastColon > 0 ? address.slice(0, lastColon) : address;
}

// ─── Smart TLS Default ──────────────────────────────────────────────

export function resolveTlsEnabled(tls: TlsOptions | boolean | undefined, address: string): boolean {
  if (typeof tls === 'boolean') return tls;
  if (typeof tls === 'object' && tls.enabled !== undefined) return tls.enabled;
  return !isLocalhostAddress(address);
}

/**
 * Normalize the tls option from ClientOptions into a concrete TlsOptions
 * object with `enabled` resolved.
 */
export function normalizeTlsOptions(
  tls: TlsOptions | boolean | undefined,
  address: string,
): TlsOptions & { enabled: boolean } {
  const enabled = resolveTlsEnabled(tls, address);
  if (typeof tls === 'boolean' || tls === undefined) {
    return { enabled };
  }
  return { ...tls, enabled };
}

// ─── TLS Version Validation ─────────────────────────────────────────

const ALLOWED_TLS_VERSIONS = new Set(['TLSv1.2', 'TLSv1.3']);

export function validateMinTlsVersion(minVersion: string | undefined): void {
  const version = minVersion ?? 'TLSv1.2';
  if (!ALLOWED_TLS_VERSIONS.has(version)) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: `Unsupported minimum TLS version: "${String(minVersion)}". Allowed: TLSv1.2, TLSv1.3`,
      operation: 'createTransport',
      isRetryable: false,
      suggestion: 'Use "TLSv1.2" or "TLSv1.3" as the minimum TLS version.',
    });
  }
}

// ─── Certificate Validation ─────────────────────────────────────────

export async function validateCertificates(opts: TlsOptions, logger: Logger): Promise<void> {
  if (opts.clientCert && !opts.clientKey) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: 'Client certificate provided without client key — both are required for mTLS',
      operation: 'validateCertificates',
      isRetryable: false,
      suggestion: 'Provide both clientCert and clientKey for mTLS.',
    });
  }

  if (!opts.clientCert && opts.clientKey) {
    throw new ConfigurationError({
      code: ErrorCode.ConfigurationError,
      message: 'Client key provided without client certificate — both are required for mTLS',
      operation: 'validateCertificates',
      isRetryable: false,
      suggestion: 'Provide both clientCert and clientKey for mTLS.',
    });
  }

  if (opts.clientCert) {
    const certPem = await resolvePemOrPath(opts.clientCert);
    try {
      const cert = new X509Certificate(certPem);
      const now = new Date();
      if (new Date(cert.validTo) < now) {
        throw new AuthenticationError({
          code: ErrorCode.AuthFailed,
          message: `Client certificate expired on ${cert.validTo}`,
          operation: 'validateCertificates',
          isRetryable: false,
          suggestion: `Renew the client certificate. It expired on ${cert.validTo}.`,
        });
      }
      if (new Date(cert.validFrom) > now) {
        throw new AuthenticationError({
          code: ErrorCode.AuthFailed,
          message: `Client certificate is not yet valid (valid from ${cert.validFrom})`,
          operation: 'validateCertificates',
          isRetryable: false,
          suggestion: `Certificate becomes valid on ${cert.validFrom}. Check system clock.`,
        });
      }
      logger.debug('Client certificate validated', {
        subject: cert.subject,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
      });
    } catch (err: unknown) {
      if (err instanceof AuthenticationError) throw err;
      throw new AuthenticationError({
        code: ErrorCode.AuthFailed,
        message: `Invalid client certificate: ${err instanceof Error ? err.message : String(err)}`,
        operation: 'validateCertificates',
        isRetryable: false,
        cause: err instanceof Error ? err : undefined,
        suggestion: 'Check that the certificate is valid PEM format.',
      });
    }
  }

  if (opts.clientKey) {
    const keyPem = await resolvePemOrPath(opts.clientKey);
    if (!keyPem.toString('utf-8').includes('-----BEGIN')) {
      throw new AuthenticationError({
        code: ErrorCode.AuthFailed,
        message: 'Client private key does not appear to be PEM-encoded',
        operation: 'validateCertificates',
        isRetryable: false,
        suggestion: 'Provide a PEM-encoded private key file or buffer.',
      });
    }
  }

  validateMinTlsVersion(opts.minVersion);
}

// ─── TLS Credential Source ───────────────────────────────────────────

export interface TlsCredentialSource {
  readonly options: TlsOptions;
  readonly logger: Logger;
}

// ─── SSL Credential Building ─────────────────────────────────────────

export interface SslCredentialParts {
  rootCerts: Buffer | null;
  clientCert: Buffer | null;
  clientKey: Buffer | null;
  insecureSkipVerify: boolean;
}

/**
 * Resolve all TLS cert/key inputs into Buffers for gRPC.
 * Called during initial connection and on reconnection (for cert rotation).
 */
export async function resolveSslParts(
  opts: TlsOptions,
  logger: Logger,
): Promise<SslCredentialParts> {
  let rootCerts: Buffer | null = null;
  let clientCert: Buffer | null = null;
  let clientKey: Buffer | null = null;

  if (opts.caCert) {
    rootCerts = await resolvePemOrPath(opts.caCert);
    logger.debug('CA certificate loaded', {
      source: typeof opts.caCert === 'string' && !opts.caCert.startsWith('-----') ? 'file' : 'pem',
    });
  }

  if (opts.clientCert && opts.clientKey) {
    clientCert = await resolvePemOrPath(opts.clientCert);
    clientKey = await resolvePemOrPath(opts.clientKey);
    logger.debug('Client certificate and key loaded for mTLS');
  }

  if (opts.insecureSkipVerify) {
    logger.warn('certificate verification is disabled — do not use in production');
  }

  return {
    rootCerts,
    clientCert,
    clientKey,
    insecureSkipVerify: opts.insecureSkipVerify ?? false,
  };
}

/**
 * Build fresh SSL credentials by re-reading cert sources.
 * Called on every reconnection attempt for cert rotation support.
 */
export async function buildFreshSslParts(source: TlsCredentialSource): Promise<SslCredentialParts> {
  const { options: opts, logger } = source;

  logger.debug('Reloading TLS credentials for reconnection');

  try {
    const parts = await resolveSslParts(opts, logger);

    logger.debug('TLS credentials reloaded successfully', {
      hasCaCert: !!parts.rootCerts,
      hasClientCert: !!parts.clientCert,
      source: getSourceType(opts),
    });

    return parts;
  } catch (err: unknown) {
    logger.error('TLS credential reload failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function getSourceType(opts: TlsOptions): string {
  if (opts.clientCert) {
    return Buffer.isBuffer(opts.clientCert) ? 'pem-buffer' : 'file';
  }
  return 'none';
}
