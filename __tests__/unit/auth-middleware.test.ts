import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeMetadata,
  fetchTokenForMetadata,
  emitSecurityWarnings,
} from '../../src/internal/middleware/auth.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('sanitizeMetadata', () => {
  it('redacts authorization header', () => {
    const result = sanitizeMetadata({ authorization: 'Bearer secret' });
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('redacts cookie header', () => {
    const result = sanitizeMetadata({ cookie: 'session=abc' });
    expect(result.cookie).toBe('[REDACTED]');
  });

  it('redacts x-api-key header', () => {
    const result = sanitizeMetadata({ 'x-api-key': 'key-123' });
    expect(result['x-api-key']).toBe('[REDACTED]');
  });

  it('redacts case-insensitively (set-cookie)', () => {
    const result = sanitizeMetadata({ 'set-cookie': 'val' });
    expect(result['set-cookie']).toBe('[REDACTED]');
  });

  it('preserves non-sensitive keys', () => {
    const result = sanitizeMetadata({
      'content-type': 'application/grpc',
      'x-request-id': 'req-123',
    });
    expect(result['content-type']).toBe('application/grpc');
    expect(result['x-request-id']).toBe('req-123');
  });

  it('handles mixed sensitive and non-sensitive keys', () => {
    const result = sanitizeMetadata({
      authorization: 'Bearer token',
      'content-type': 'application/grpc',
      cookie: 'session=val',
      'x-custom': 'safe',
    });
    expect(result).toEqual({
      authorization: '[REDACTED]',
      'content-type': 'application/grpc',
      cookie: '[REDACTED]',
      'x-custom': 'safe',
    });
  });

  it('returns empty object for empty input', () => {
    expect(sanitizeMetadata({})).toEqual({});
  });
});

describe('fetchTokenForMetadata', () => {
  it('returns token on success', async () => {
    const logger = createMockLogger();
    const tokenCache = { getToken: vi.fn().mockResolvedValue('my-token') };

    const result = await fetchTokenForMetadata(tokenCache as never, logger);

    expect(result).toBe('my-token');
    expect(logger.debug).toHaveBeenCalledWith(
      'Token injected into gRPC metadata',
      expect.objectContaining({ tokenPresent: true }),
    );
  });

  it('returns undefined on failure and logs warning', async () => {
    const logger = createMockLogger();
    const tokenCache = {
      getToken: vi.fn().mockRejectedValue(new Error('auth-fail')),
    };

    const result = await fetchTokenForMetadata(tokenCache as never, logger);

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Credential provider failed — request will proceed without token',
      expect.objectContaining({ error: 'auth-fail' }),
    );
  });

  it('handles non-Error rejections', async () => {
    const logger = createMockLogger();
    const tokenCache = {
      getToken: vi.fn().mockRejectedValue('string-error'),
    };

    const result = await fetchTokenForMetadata(tokenCache as never, logger);

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Credential provider failed — request will proceed without token',
      expect.objectContaining({ error: 'string-error' }),
    );
  });
});

describe('emitSecurityWarnings', () => {
  it('warns when insecureSkipVerify is true', () => {
    const logger = createMockLogger();

    emitSecurityWarnings(
      { insecureSkipVerify: true, tlsEnabled: true, address: 'remote:50000' },
      false,
      logger,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'certificate verification is disabled — this connection is insecure',
      expect.objectContaining({
        address: 'remote:50000',
        insecureSkipVerify: true,
      }),
    );
  });

  it('warns when TLS is disabled for non-localhost', () => {
    const logger = createMockLogger();

    emitSecurityWarnings({ tlsEnabled: false, address: 'remote:50000' }, false, logger);

    expect(logger.warn).toHaveBeenCalledWith(
      'TLS is disabled for a remote address — connection is unencrypted',
      expect.objectContaining({
        address: 'remote:50000',
        tlsEnabled: false,
      }),
    );
  });

  it('does not warn about TLS when address is localhost', () => {
    const logger = createMockLogger();

    emitSecurityWarnings({ tlsEnabled: false, address: 'localhost:50000' }, true, logger);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not warn when TLS is enabled and verify is on', () => {
    const logger = createMockLogger();

    emitSecurityWarnings({ tlsEnabled: true, address: 'remote:50000' }, false, logger);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('emits both warnings when insecureSkipVerify and no TLS on remote', () => {
    const logger = createMockLogger();

    emitSecurityWarnings(
      { insecureSkipVerify: true, tlsEnabled: false, address: 'remote:50000' },
      false,
      logger,
    );

    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});
