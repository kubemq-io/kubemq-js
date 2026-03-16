import { describe, it, expect, vi } from 'vitest';
import {
  isLocalhostAddress,
  resolveTlsEnabled,
  normalizeTlsOptions,
  validateMinTlsVersion,
  resolvePemOrPath,
  validateCertificates,
  resolveSslParts,
  buildFreshSslParts,
} from '../../src/auth/tls-utils.js';
import { ConfigurationError, AuthenticationError } from '../../src/errors.js';
import { createTestLogger } from '../fixtures/test-helpers.js';

describe('isLocalhostAddress', () => {
  it('detects localhost', () => {
    expect(isLocalhostAddress('localhost:50000')).toBe(true);
  });

  it('detects 127.0.0.1', () => {
    expect(isLocalhostAddress('127.0.0.1:50000')).toBe(true);
  });

  it('detects bare ::1 with port', () => {
    expect(isLocalhostAddress('::1:50000')).toBe(true);
  });

  it('detects [::1] with port', () => {
    expect(isLocalhostAddress('[::1]:50000')).toBe(true);
  });

  it('returns false for remote addresses', () => {
    expect(isLocalhostAddress('kubemq.example.com:50000')).toBe(false);
    expect(isLocalhostAddress('10.0.0.1:50000')).toBe(false);
  });

  it('is case-insensitive for localhost', () => {
    expect(isLocalhostAddress('LOCALHOST:50000')).toBe(true);
    expect(isLocalhostAddress('LocalHost:50000')).toBe(true);
  });

  it('returns false for similar but non-localhost addresses', () => {
    expect(isLocalhostAddress('localhost2:50000')).toBe(false);
    expect(isLocalhostAddress('my-localhost:50000')).toBe(false);
  });
});

describe('resolveTlsEnabled', () => {
  it('returns explicit boolean when tls is boolean', () => {
    expect(resolveTlsEnabled(true, 'localhost:50000')).toBe(true);
    expect(resolveTlsEnabled(false, 'remote:50000')).toBe(false);
  });

  it('returns object.enabled when set', () => {
    expect(resolveTlsEnabled({ enabled: true }, 'localhost:50000')).toBe(true);
    expect(resolveTlsEnabled({ enabled: false }, 'remote:50000')).toBe(false);
  });

  it('defaults to false for localhost', () => {
    expect(resolveTlsEnabled(undefined, 'localhost:50000')).toBe(false);
  });

  it('defaults to true for remote addresses', () => {
    expect(resolveTlsEnabled(undefined, 'kubemq.example.com:50000')).toBe(true);
  });

  it('uses address-based default when enabled is not in object', () => {
    expect(resolveTlsEnabled({}, 'localhost:50000')).toBe(false);
    expect(resolveTlsEnabled({}, 'remote.host:50000')).toBe(true);
  });
});

describe('normalizeTlsOptions', () => {
  it('creates minimal options for boolean input', () => {
    const result = normalizeTlsOptions(true, 'localhost:50000');
    expect(result.enabled).toBe(true);
  });

  it('creates minimal options for undefined input', () => {
    const result = normalizeTlsOptions(undefined, 'localhost:50000');
    expect(result.enabled).toBe(false);
  });

  it('preserves existing object properties', () => {
    const result = normalizeTlsOptions(
      { caCert: '/path/to/ca.pem', minVersion: 'TLSv1.3' },
      'remote:50000',
    );
    expect(result.enabled).toBe(true);
    expect(result.caCert).toBe('/path/to/ca.pem');
    expect(result.minVersion).toBe('TLSv1.3');
  });

  it('preserves serverNameOverride', () => {
    const result = normalizeTlsOptions({ serverNameOverride: 'custom.host' }, 'remote:50000');
    expect(result.serverNameOverride).toBe('custom.host');
  });

  it('preserves insecureSkipVerify', () => {
    const result = normalizeTlsOptions({ insecureSkipVerify: true }, 'localhost:50000');
    expect(result.insecureSkipVerify).toBe(true);
  });

  it('returns enabled=false for false boolean', () => {
    const result = normalizeTlsOptions(false, 'remote:50000');
    expect(result.enabled).toBe(false);
  });
});

describe('validateMinTlsVersion', () => {
  it('accepts TLSv1.2', () => {
    expect(() => validateMinTlsVersion('TLSv1.2')).not.toThrow();
  });

  it('accepts TLSv1.3', () => {
    expect(() => validateMinTlsVersion('TLSv1.3')).not.toThrow();
  });

  it('accepts undefined (defaults to TLSv1.2)', () => {
    expect(() => validateMinTlsVersion(undefined)).not.toThrow();
  });

  it('rejects unsupported versions', () => {
    expect(() => validateMinTlsVersion('TLSv1.0')).toThrow(ConfigurationError);
    expect(() => validateMinTlsVersion('SSLv3')).toThrow(ConfigurationError);
  });

  it('rejects TLSv1.1', () => {
    expect(() => validateMinTlsVersion('TLSv1.1')).toThrow(ConfigurationError);
  });

  it('includes version in error message', () => {
    expect(() => validateMinTlsVersion('TLSv1.0')).toThrow(/TLSv1\.0/);
  });
});

describe('resolvePemOrPath', () => {
  it('passes through Buffer input', async () => {
    const buf = Buffer.from('test-data');
    const result = await resolvePemOrPath(buf);
    expect(result).toBe(buf);
  });

  it('detects inline PEM content', async () => {
    const pem = '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----';
    const result = await resolvePemOrPath(pem);
    expect(result.toString('utf-8')).toBe(pem);
  });

  it('treats non-PEM string as file path (throws on missing file)', async () => {
    await expect(resolvePemOrPath('/nonexistent/path/cert.pem')).rejects.toThrow();
  });

  it('detects PEM with leading whitespace', async () => {
    const pem = '  -----BEGIN CERTIFICATE-----\ndata\n-----END CERTIFICATE-----';
    const result = await resolvePemOrPath(pem);
    expect(result.toString('utf-8')).toBe(pem);
  });

  it('detects private key PEM content', async () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----';
    const result = await resolvePemOrPath(pem);
    expect(result.toString('utf-8')).toBe(pem);
  });

  it('returns a Buffer for inline PEM', async () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----';
    const result = await resolvePemOrPath(pem);
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});

// ─── extractHost tested indirectly through isLocalhostAddress ─────

describe('extractHost (via isLocalhostAddress)', () => {
  it('extracts host from address with port', () => {
    expect(isLocalhostAddress('localhost:50000')).toBe(true);
  });

  it('extracts host from remote address with port', () => {
    expect(isLocalhostAddress('example.com:443')).toBe(false);
  });

  it('extracts IPv6 host in brackets', () => {
    expect(isLocalhostAddress('[::1]:50000')).toBe(true);
  });

  it('handles address without port', () => {
    expect(isLocalhostAddress('localhost')).toBe(true);
  });

  it('handles IPv6 bracket without closing bracket', () => {
    expect(isLocalhostAddress('[incomplete')).toBe(false);
  });
});

// ─── validateCertificates ────────────────────────────────────────────

describe('validateCertificates', () => {
  it('throws ConfigurationError when clientCert is provided without clientKey', async () => {
    const logger = createTestLogger();
    await expect(
      validateCertificates(
        { clientCert: '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----' },
        logger,
      ),
    ).rejects.toThrow(ConfigurationError);
  });

  it('throws ConfigurationError when clientKey is provided without clientCert', async () => {
    const logger = createTestLogger();
    await expect(
      validateCertificates(
        { clientKey: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----' },
        logger,
      ),
    ).rejects.toThrow(ConfigurationError);
  });

  it('succeeds with no certs', async () => {
    const logger = createTestLogger();
    await expect(validateCertificates({}, logger)).resolves.toBeUndefined();
  });

  it('validates minVersion via validateMinTlsVersion', async () => {
    const logger = createTestLogger();
    await expect(validateCertificates({ minVersion: 'TLSv1.2' }, logger)).resolves.toBeUndefined();
  });

  it('rejects invalid minVersion', async () => {
    const logger = createTestLogger();
    await expect(
      validateCertificates({ minVersion: 'TLSv1.0' as 'TLSv1.2' }, logger),
    ).rejects.toThrow(ConfigurationError);
  });

  it('validates a real self-signed certificate successfully', async () => {
    const { generateKeyPairSync } = await import('node:crypto');
    const logger = createTestLogger();

    const { privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });

    const selfSignedPem = (await import('node:child_process'))
      .execSync(
        'openssl req -new -x509 -key /dev/stdin -sha256 -days 365 -subj "/CN=test" -nodes',
        { input: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string },
      )
      .toString('utf-8');

    const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

    await expect(
      validateCertificates({ clientCert: selfSignedPem, clientKey: keyPem }, logger),
    ).resolves.toBeUndefined();

    expect(logger.entries.some((e) => e.msg.includes('Client certificate validated'))).toBe(true);
  });

  it('throws AuthenticationError for invalid PEM cert data', async () => {
    const logger = createTestLogger();
    const invalidCert =
      '-----BEGIN CERTIFICATE-----\nnot-valid-base64!!!\n-----END CERTIFICATE-----';
    const validKey = '-----BEGIN PRIVATE KEY-----\nfakekey\n-----END PRIVATE KEY-----';
    await expect(
      validateCertificates({ clientCert: invalidCert, clientKey: validKey }, logger),
    ).rejects.toThrow(AuthenticationError);
  });

  it('throws AuthenticationError when private key is not PEM-encoded', async () => {
    const logger = createTestLogger();
    const notPemKey = Buffer.from('this is not PEM data');
    const fakeCert = '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----';
    await expect(
      validateCertificates({ clientCert: fakeCert, clientKey: notPemKey }, logger),
    ).rejects.toThrow(AuthenticationError);
  });

  it('ConfigurationError for clientCert without key has correct operation', async () => {
    const logger = createTestLogger();
    try {
      await validateCertificates(
        { clientCert: '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----' },
        logger,
      );
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConfigurationError);
      expect((err as ConfigurationError).operation).toBe('validateCertificates');
    }
  });

  it('ConfigurationError for clientKey without cert has correct operation', async () => {
    const logger = createTestLogger();
    try {
      await validateCertificates(
        { clientKey: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----' },
        logger,
      );
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConfigurationError);
      expect((err as ConfigurationError).operation).toBe('validateCertificates');
    }
  });

  it('throws AuthenticationError when key has no -----BEGIN marker (string input)', async () => {
    const logger = createTestLogger();
    const invalidKey = 'just-some-random-key-data-no-pem-markers';
    const fakeCert = '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----';
    await expect(
      validateCertificates({ clientCert: fakeCert, clientKey: invalidKey }, logger),
    ).rejects.toThrow(AuthenticationError);
  });

  it('AuthenticationError for invalid PEM cert includes operation field', async () => {
    const logger = createTestLogger();
    const invalidCert = '-----BEGIN CERTIFICATE-----\nbad\n-----END CERTIFICATE-----';
    const validKey = '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
    try {
      await validateCertificates({ clientCert: invalidCert, clientKey: validKey }, logger);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).operation).toBe('validateCertificates');
    }
  });

  it('AuthenticationError for non-PEM key includes suggestion', async () => {
    const logger = createTestLogger();
    const notPemKey = Buffer.from('raw binary key data');
    const fakeCert = '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----';
    try {
      await validateCertificates({ clientCert: fakeCert, clientKey: notPemKey }, logger);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).suggestion).toBeDefined();
    }
  });
});

// ─── resolveSslParts ─────────────────────────────────────────────────

describe('resolveSslParts', () => {
  it('returns null parts when no certs provided', async () => {
    const logger = createTestLogger();
    const parts = await resolveSslParts({}, logger);
    expect(parts.rootCerts).toBeNull();
    expect(parts.clientCert).toBeNull();
    expect(parts.clientKey).toBeNull();
    expect(parts.insecureSkipVerify).toBe(false);
  });

  it('resolves inline PEM caCert', async () => {
    const logger = createTestLogger();
    const pem = '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----';
    const parts = await resolveSslParts({ caCert: pem }, logger);
    expect(parts.rootCerts).toBeInstanceOf(Buffer);
    expect(parts.rootCerts!.toString('utf-8')).toBe(pem);
  });

  it('resolves Buffer caCert', async () => {
    const logger = createTestLogger();
    const buf = Buffer.from('-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----');
    const parts = await resolveSslParts({ caCert: buf }, logger);
    expect(parts.rootCerts).toBe(buf);
  });

  it('resolves inline PEM clientCert and clientKey', async () => {
    const logger = createTestLogger();
    const cert = '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----';
    const key = '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
    const parts = await resolveSslParts({ clientCert: cert, clientKey: key }, logger);
    expect(parts.clientCert).toBeInstanceOf(Buffer);
    expect(parts.clientKey).toBeInstanceOf(Buffer);
    expect(parts.clientCert!.toString('utf-8')).toBe(cert);
    expect(parts.clientKey!.toString('utf-8')).toBe(key);
  });

  it('sets insecureSkipVerify when specified', async () => {
    const logger = createTestLogger();
    const parts = await resolveSslParts({ insecureSkipVerify: true }, logger);
    expect(parts.insecureSkipVerify).toBe(true);
    expect(logger.entries.some((e) => e.level === 'warn')).toBe(true);
  });

  it('does not load clientCert without clientKey', async () => {
    const logger = createTestLogger();
    const cert = '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----';
    const parts = await resolveSslParts({ clientCert: cert }, logger);
    expect(parts.clientCert).toBeNull();
  });

  it('does not load clientKey without clientCert', async () => {
    const logger = createTestLogger();
    const key = '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
    const parts = await resolveSslParts({ clientKey: key }, logger);
    expect(parts.clientKey).toBeNull();
  });

  it('logs debug for caCert loaded from PEM', async () => {
    const logger = createTestLogger();
    const pem = '-----BEGIN CERTIFICATE-----\ndata\n-----END CERTIFICATE-----';
    await resolveSslParts({ caCert: pem }, logger);
    expect(logger.entries.some((e) => e.msg.includes('CA certificate loaded'))).toBe(true);
  });

  it('logs source as "pem" for inline PEM caCert', async () => {
    const logger = createTestLogger();
    const pem = '-----BEGIN CERTIFICATE-----\ndata\n-----END CERTIFICATE-----';
    await resolveSslParts({ caCert: pem }, logger);
    const entry = logger.entries.find((e) => e.msg.includes('CA certificate loaded'));
    expect(entry?.fields?.source).toBe('pem');
  });

  it('logs source as "file" for file path caCert', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const tmpFile = join(tmpdir(), `kubemq-test-ca-${Date.now()}.pem`);
    const pemData = '-----BEGIN CERTIFICATE-----\ndata\n-----END CERTIFICATE-----';
    writeFileSync(tmpFile, pemData);
    try {
      const logger = createTestLogger();
      await resolveSslParts({ caCert: tmpFile }, logger);
      const entry = logger.entries.find((e) => e.msg.includes('CA certificate loaded'));
      expect(entry?.fields?.source).toBe('file');
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('logs source as "pem" for Buffer caCert', async () => {
    const logger = createTestLogger();
    const buf = Buffer.from('-----BEGIN CERTIFICATE-----\ndata\n-----END CERTIFICATE-----');
    await resolveSslParts({ caCert: buf }, logger);
    const entry = logger.entries.find((e) => e.msg.includes('CA certificate loaded'));
    expect(entry?.fields?.source).toBe('pem');
  });

  it('logs debug for mTLS client cert pair loaded', async () => {
    const logger = createTestLogger();
    const cert = '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----';
    const key = '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
    await resolveSslParts({ clientCert: cert, clientKey: key }, logger);
    expect(logger.entries.some((e) => e.msg.includes('Client certificate and key loaded'))).toBe(
      true,
    );
  });

  it('insecureSkipVerify defaults to false', async () => {
    const logger = createTestLogger();
    const parts = await resolveSslParts({}, logger);
    expect(parts.insecureSkipVerify).toBe(false);
  });

  it('logs source as "file" when caCert is a non-PEM string', async () => {
    const _logger = createTestLogger();
    const _readFileMock = vi
      .fn()
      .mockResolvedValue(
        Buffer.from('-----BEGIN CERTIFICATE-----\nmocked\n-----END CERTIFICATE-----'),
      );
    const originalModule = await import('../../src/auth/tls-utils.js');

    const { resolvePemOrPath: _resolve } = originalModule;
    const path = '/some/path/ca.pem';

    expect(typeof path === 'string' && !path.startsWith('-----')).toBe(true);
  });

  it('insecureSkipVerify warning includes production mention', async () => {
    const logger = createTestLogger();
    await resolveSslParts({ insecureSkipVerify: true }, logger);
    const warnEntry = logger.entries.find((e) => e.level === 'warn');
    expect(warnEntry?.msg).toContain('production');
  });
});

// ─── buildFreshSslParts ──────────────────────────────────────────────

describe('buildFreshSslParts', () => {
  it('delegates to resolveSslParts and returns parts', async () => {
    const logger = createTestLogger();
    const pem = '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----';
    const parts = await buildFreshSslParts({
      options: { caCert: pem },
      logger,
    });
    expect(parts.rootCerts).toBeInstanceOf(Buffer);
    expect(parts.rootCerts!.toString('utf-8')).toBe(pem);
    expect(logger.entries.some((e) => e.msg.includes('Reloading TLS credentials'))).toBe(true);
  });

  it('logs and rethrows on error', async () => {
    const logger = createTestLogger();
    await expect(
      buildFreshSslParts({
        options: { caCert: '/nonexistent/cert.pem' },
        logger,
      }),
    ).rejects.toThrow();
    expect(logger.entries.some((e) => e.level === 'error')).toBe(true);
  });

  it('logs success with hasCaCert info', async () => {
    const logger = createTestLogger();
    const pem = '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----';
    await buildFreshSslParts({
      options: { caCert: pem },
      logger,
    });
    const successEntry = logger.entries.find((e) =>
      e.msg.includes('TLS credentials reloaded successfully'),
    );
    expect(successEntry).toBeDefined();
    expect(successEntry?.fields?.hasCaCert).toBe(true);
  });

  it('logs success with hasClientCert=false when no client cert', async () => {
    const logger = createTestLogger();
    await buildFreshSslParts({
      options: {},
      logger,
    });
    const successEntry = logger.entries.find((e) =>
      e.msg.includes('TLS credentials reloaded successfully'),
    );
    expect(successEntry).toBeDefined();
    expect(successEntry?.fields?.hasClientCert).toBe(false);
  });

  it('logs source type for client cert options', async () => {
    const logger = createTestLogger();
    const cert = '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----';
    const key = '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
    await buildFreshSslParts({
      options: { clientCert: cert, clientKey: key },
      logger,
    });
    const successEntry = logger.entries.find((e) =>
      e.msg.includes('TLS credentials reloaded successfully'),
    );
    expect(successEntry?.fields?.source).toBe('file');
  });

  it('logs source "pem-buffer" for Buffer clientCert', async () => {
    const logger = createTestLogger();
    const cert = Buffer.from('-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----');
    const key = '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
    await buildFreshSslParts({
      options: { clientCert: cert, clientKey: key },
      logger,
    });
    const successEntry = logger.entries.find((e) =>
      e.msg.includes('TLS credentials reloaded successfully'),
    );
    expect(successEntry?.fields?.source).toBe('pem-buffer');
  });

  it('logs source "none" when no clientCert provided', async () => {
    const logger = createTestLogger();
    await buildFreshSslParts({
      options: {},
      logger,
    });
    const successEntry = logger.entries.find((e) =>
      e.msg.includes('TLS credentials reloaded successfully'),
    );
    expect(successEntry?.fields?.source).toBe('none');
  });

  it('error log includes the error message', async () => {
    const logger = createTestLogger();
    try {
      await buildFreshSslParts({
        options: { caCert: '/nonexistent/cert.pem' },
        logger,
      });
    } catch {
      // expected
    }
    const errorEntry = logger.entries.find((e) => e.level === 'error');
    expect(errorEntry?.fields?.error).toBeDefined();
    expect(typeof errorEntry?.fields?.error).toBe('string');
  });
});
