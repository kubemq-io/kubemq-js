import { describe, it, expect } from 'vitest';
import { validateCertificates } from '../../src/auth/tls-utils.js';
import { AuthenticationError } from '../../src/errors.js';

const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe('validateCertificates detailed paths', () => {
  it('throws AuthenticationError for invalid PEM certificate content', async () => {
    await expect(
      validateCertificates(
        {
          clientCert: Buffer.from('not-a-valid-pem-cert'),
          clientKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        },
        logger,
      ),
    ).rejects.toThrow(AuthenticationError);
  });

  it('throws AuthenticationError when cert does not parse as X509', async () => {
    await expect(
      validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\ncorrupted-data\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nkey-data\n-----END PRIVATE KEY-----',
        },
        logger,
      ),
    ).rejects.toThrow(AuthenticationError);
  });

  it('thrown error includes "Invalid client certificate" message', async () => {
    try {
      await validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nbad\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
        },
        logger,
      );
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).message).toContain('Invalid client certificate');
    }
  });

  it('thrown error has operation set to validateCertificates', async () => {
    try {
      await validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\ngarbage\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
        },
        logger,
      );
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).operation).toBe('validateCertificates');
    }
  });

  it('throws AuthenticationError when cert is a Buffer with invalid content', async () => {
    await expect(
      validateCertificates(
        {
          clientCert: Buffer.from(
            '-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----',
          ),
          clientKey: Buffer.from('-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----'),
        },
        logger,
      ),
    ).rejects.toThrow(AuthenticationError);
  });

  it('thrown error includes suggestion about PEM format', async () => {
    try {
      await validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nnotbase64!!!\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
        },
        logger,
      );
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).suggestion).toContain('PEM');
    }
  });
});
