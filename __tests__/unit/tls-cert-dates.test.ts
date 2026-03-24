import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthenticationError } from '../../src/errors.js';

const { mockX509 } = vi.hoisted(() => ({
  mockX509: vi.fn(),
}));

vi.mock('node:crypto', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:crypto')>();
  return {
    ...original,
    X509Certificate: mockX509,
  };
});

const { validateCertificates } = await import('../../src/auth/tls-utils.js');

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateCertificates — expired certificate', () => {
  it('throws AuthenticationError for expired certificate', async () => {
    mockX509.mockImplementation(function (this: any) {
      Object.assign(this, {
        validTo: '2020-01-01T00:00:00.000Z',
        validFrom: '2019-01-01T00:00:00.000Z',
        subject: 'CN=test',
      });
    });

    await expect(
      validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nvalidcert\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nvalidkey\n-----END PRIVATE KEY-----',
        },
        logger,
      ),
    ).rejects.toThrow(AuthenticationError);
  });

  it('error message includes "expired"', async () => {
    mockX509.mockImplementation(function (this: any) {
      Object.assign(this, {
        validTo: '2020-06-15T00:00:00.000Z',
        validFrom: '2019-06-15T00:00:00.000Z',
        subject: 'CN=test',
      });
    });

    try {
      await validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nexpired\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
        },
        logger,
      );
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).message).toContain('expired');
    }
  });
});

describe('validateCertificates — not yet valid certificate', () => {
  it('throws AuthenticationError for not-yet-valid certificate', async () => {
    mockX509.mockImplementation(function (this: any) {
      Object.assign(this, {
        validTo: '2099-01-01T00:00:00.000Z',
        validFrom: '2099-01-01T00:00:00.000Z',
        subject: 'CN=future',
      });
    });

    await expect(
      validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nfuturecert\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
        },
        logger,
      ),
    ).rejects.toThrow(AuthenticationError);
  });

  it('error message includes "not yet valid"', async () => {
    mockX509.mockImplementation(function (this: any) {
      Object.assign(this, {
        validTo: '2099-12-31T00:00:00.000Z',
        validFrom: '2099-01-01T00:00:00.000Z',
        subject: 'CN=future',
      });
    });

    try {
      await validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nfuture\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
        },
        logger,
      );
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).message).toContain('not yet valid');
    }
  });

  it('error suggestion mentions system clock', async () => {
    mockX509.mockImplementation(function (this: any) {
      Object.assign(this, {
        validTo: '2099-12-31T00:00:00.000Z',
        validFrom: '2099-01-01T00:00:00.000Z',
        subject: 'CN=future',
      });
    });

    try {
      await validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nfuturecert2\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nkey2\n-----END PRIVATE KEY-----',
        },
        logger,
      );
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect((err as AuthenticationError).suggestion).toContain('system clock');
    }
  });
});

describe('validateCertificates — valid cert passes', () => {
  it('valid cert with good dates logs debug and does not throw', async () => {
    mockX509.mockImplementation(function (this: any) {
      Object.assign(this, {
        validTo: '2099-12-31T00:00:00.000Z',
        validFrom: '2020-01-01T00:00:00.000Z',
        subject: 'CN=valid',
      });
    });

    await expect(
      validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nvalidcert\n-----END CERTIFICATE-----',
          clientKey: '-----BEGIN PRIVATE KEY-----\nvalidkey\n-----END PRIVATE KEY-----',
        },
        logger,
      ),
    ).resolves.toBeUndefined();

    expect(logger.debug).toHaveBeenCalledWith('Client certificate validated', expect.any(Object));
  });
});

describe('validateCertificates — non-PEM key', () => {
  it('throws AuthenticationError for non-PEM encoded key', async () => {
    mockX509.mockImplementation(function (this: any) {
      Object.assign(this, {
        validTo: '2099-12-31T00:00:00.000Z',
        validFrom: '2020-01-01T00:00:00.000Z',
        subject: 'CN=valid',
      });
    });

    await expect(
      validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nvalid\n-----END CERTIFICATE-----',
          clientKey: Buffer.from('not a pem key at all'),
        },
        logger,
      ),
    ).rejects.toThrow(AuthenticationError);
  });

  it('error message mentions PEM-encoded', async () => {
    mockX509.mockImplementation(function (this: any) {
      Object.assign(this, {
        validTo: '2099-12-31T00:00:00.000Z',
        validFrom: '2020-01-01T00:00:00.000Z',
        subject: 'CN=valid',
      });
    });

    try {
      await validateCertificates(
        {
          clientCert: '-----BEGIN CERTIFICATE-----\nvalid\n-----END CERTIFICATE-----',
          clientKey: Buffer.from('binary-key-data'),
        },
        logger,
      );
      expect.fail('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect((err as AuthenticationError).message).toContain('PEM-encoded');
    }
  });
});
