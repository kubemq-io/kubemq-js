import { describe, it, expect } from 'vitest';
import { validateClientOptions } from '../../src/internal/config-validator.js';
import { ConfigurationError } from '../../src/errors.js';

describe('ClientOptions validation', () => {
  it('rejects empty address', () => {
    expect(() => validateClientOptions({ address: '' })).toThrow(ConfigurationError);
  });

  it('rejects whitespace-only address', () => {
    expect(() => validateClientOptions({ address: '   ' })).toThrow(ConfigurationError);
  });

  it('rejects address without port', () => {
    expect(() => validateClientOptions({ address: 'localhost' })).toThrow(ConfigurationError);
  });

  it('rejects address with invalid port', () => {
    expect(() => validateClientOptions({ address: 'localhost:abc' })).toThrow(ConfigurationError);
  });

  it('rejects address with port 0', () => {
    expect(() => validateClientOptions({ address: 'localhost:0' })).toThrow(ConfigurationError);
  });

  it('rejects address with port > 65535', () => {
    expect(() => validateClientOptions({ address: 'localhost:99999' })).toThrow(ConfigurationError);
  });

  it('accepts valid minimal options', () => {
    expect(() => validateClientOptions({ address: 'localhost:50000' })).not.toThrow();
  });

  it('rejects negative connectionTimeoutSeconds', () => {
    expect(() =>
      validateClientOptions({ address: 'localhost:50000', connectionTimeoutSeconds: -1 }),
    ).toThrow(ConfigurationError);
  });

  it('rejects zero connectionTimeoutSeconds', () => {
    expect(() =>
      validateClientOptions({ address: 'localhost:50000', connectionTimeoutSeconds: 0 }),
    ).toThrow(ConfigurationError);
  });

  it('rejects negative maxReceiveMessageSize', () => {
    expect(() =>
      validateClientOptions({ address: 'localhost:50000', maxReceiveMessageSize: -1 }),
    ).toThrow(ConfigurationError);
  });

  it('rejects negative maxSendMessageSize', () => {
    expect(() =>
      validateClientOptions({ address: 'localhost:50000', maxSendMessageSize: -1 }),
    ).toThrow(ConfigurationError);
  });

  it('rejects negative reconnectBufferSize', () => {
    expect(() =>
      validateClientOptions({ address: 'localhost:50000', reconnectBufferSize: -1 }),
    ).toThrow(ConfigurationError);
  });

  it('accepts valid options with optional fields', () => {
    expect(() =>
      validateClientOptions({
        address: 'localhost:50000',
        clientId: 'test-client',
        connectionTimeoutSeconds: 5,
      }),
    ).not.toThrow();
  });

  it('accepts port at upper boundary (65535)', () => {
    expect(() => validateClientOptions({ address: 'localhost:65535' })).not.toThrow();
  });

  it('rejects empty clientId (whitespace only)', () => {
    expect(() => validateClientOptions({ address: 'localhost:50000', clientId: '   ' })).toThrow(
      ConfigurationError,
    );
  });

  describe('TLS validation', () => {
    it('rejects clientCert without clientKey', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          tls: { clientCert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----' },
        }),
      ).toThrow(ConfigurationError);
    });

    it('rejects clientKey without clientCert', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          tls: { clientKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----' },
        }),
      ).toThrow(ConfigurationError);
    });

    it('accepts both clientCert and clientKey together', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          tls: {
            clientCert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
            clientKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
          },
        }),
      ).not.toThrow();
    });

    it('accepts no TLS options', () => {
      expect(() => validateClientOptions({ address: 'localhost:50000' })).not.toThrow();
    });
  });

  describe('Retry policy validation', () => {
    it('rejects negative maxRetries', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          retry: {
            maxRetries: -1,
            initialBackoffMs: 100,
            maxBackoffMs: 1000,
            multiplier: 2,
            jitter: 'full',
          },
        }),
      ).toThrow(ConfigurationError);
    });

    it('rejects zero initialBackoffMs', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          retry: {
            maxRetries: 3,
            initialBackoffMs: 0,
            maxBackoffMs: 1000,
            multiplier: 2,
            jitter: 'full',
          },
        }),
      ).toThrow(ConfigurationError);
    });

    it('rejects zero maxBackoffMs', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          retry: {
            maxRetries: 3,
            initialBackoffMs: 100,
            maxBackoffMs: 0,
            multiplier: 2,
            jitter: 'full',
          },
        }),
      ).toThrow(ConfigurationError);
    });

    it('accepts valid retry config', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          retry: {
            maxRetries: 3,
            initialBackoffMs: 100,
            maxBackoffMs: 5000,
            multiplier: 2,
            jitter: 'none',
          },
        }),
      ).not.toThrow();
    });

    it('accepts undefined retry', () => {
      expect(() =>
        validateClientOptions({ address: 'localhost:50000', retry: undefined }),
      ).not.toThrow();
    });
  });

  describe('Reconnection policy validation', () => {
    it('rejects zero initialDelayMs', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          reconnect: {
            maxAttempts: 5,
            initialDelayMs: 0,
            maxDelayMs: 5000,
            multiplier: 2,
            jitter: 'full',
          },
        }),
      ).toThrow(ConfigurationError);
    });

    it('rejects zero maxDelayMs', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          reconnect: {
            maxAttempts: 5,
            initialDelayMs: 100,
            maxDelayMs: 0,
            multiplier: 2,
            jitter: 'full',
          },
        }),
      ).toThrow(ConfigurationError);
    });

    it('accepts valid reconnect config', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          reconnect: {
            maxAttempts: 10,
            initialDelayMs: 500,
            maxDelayMs: 30000,
            multiplier: 2,
            jitter: 'equal',
          },
        }),
      ).not.toThrow();
    });
  });

  describe('Keepalive validation', () => {
    it('rejects zero timeMs', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          keepalive: { timeMs: 0, timeoutMs: 5000, permitWithoutCalls: true },
        }),
      ).toThrow(ConfigurationError);
    });

    it('rejects zero timeoutMs', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          keepalive: { timeMs: 10000, timeoutMs: 0, permitWithoutCalls: true },
        }),
      ).toThrow(ConfigurationError);
    });

    it('accepts valid keepalive config', () => {
      expect(() =>
        validateClientOptions({
          address: 'localhost:50000',
          keepalive: { timeMs: 10000, timeoutMs: 5000, permitWithoutCalls: false },
        }),
      ).not.toThrow();
    });
  });
});
