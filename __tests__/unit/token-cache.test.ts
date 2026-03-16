import { describe, it, expect, vi, afterEach } from 'vitest';
import { TokenCache } from '../../src/auth/token-cache.js';
import type { CredentialProvider } from '../../src/auth/credential-provider.js';
import { AuthenticationError, TransientError } from '../../src/errors.js';
import { createTestLogger } from '../fixtures/test-helpers.js';

function makeProvider(
  tokenFn: () => Promise<{ token: string; expiresAt?: Date }>,
): CredentialProvider {
  return { getToken: tokenFn };
}

describe('TokenCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches token from provider on first call', async () => {
    const provider = makeProvider(async () => ({ token: 'abc' }));
    const cache = new TokenCache(provider, createTestLogger());
    const token = await cache.getToken();
    expect(token).toBe('abc');
  });

  it('returns cached token on subsequent calls', async () => {
    let callCount = 0;
    const provider = makeProvider(async () => {
      callCount++;
      return { token: `token-${callCount}` };
    });
    const cache = new TokenCache(provider, createTestLogger());

    const t1 = await cache.getToken();
    const t2 = await cache.getToken();
    expect(t1).toBe(t2);
    expect(callCount).toBe(1);
  });

  it('invalidate clears cached token, next call re-fetches', async () => {
    let callCount = 0;
    const provider = makeProvider(async () => {
      callCount++;
      return { token: `token-${callCount}` };
    });
    const cache = new TokenCache(provider, createTestLogger());

    await cache.getToken();
    cache.invalidate();
    const t2 = await cache.getToken();
    expect(t2).toBe('token-2');
    expect(callCount).toBe(2);
  });

  it('wraps non-KubeMQError from provider as AuthenticationError', async () => {
    const provider = makeProvider(async () => {
      throw new Error('invalid credentials');
    });
    const cache = new TokenCache(provider, createTestLogger());

    try {
      await cache.getToken();
      expect.unreachable('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AuthenticationError);
    }
  });

  it('classifies transient provider errors', async () => {
    const provider = makeProvider(async () => {
      throw new Error('ECONNREFUSED');
    });
    const cache = new TokenCache(provider, createTestLogger());

    try {
      await cache.getToken();
      expect.unreachable('should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(TransientError);
    }
  });

  it('dispose clears state', async () => {
    const provider = makeProvider(async () => ({ token: 'abc' }));
    const cache = new TokenCache(provider, createTestLogger());
    await cache.getToken();
    cache.dispose();
  });

  it('re-fetches when cached token has expired', async () => {
    let callCount = 0;
    const provider = makeProvider(async () => {
      callCount++;
      return {
        token: `token-${callCount}`,
        expiresAt: new Date(Date.now() - 1000),
      };
    });
    const cache = new TokenCache(provider, createTestLogger());

    const t1 = await cache.getToken();
    expect(t1).toBe('token-1');

    const t2 = await cache.getToken();
    expect(t2).toBe('token-2');
    expect(callCount).toBe(2);
  });

  it('schedules proactive refresh and re-fetches before expiry', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const provider = makeProvider(async () => {
      callCount++;
      return {
        token: `token-${callCount}`,
        expiresAt: new Date(Date.now() + 60_000),
      };
    });
    const cache = new TokenCache(provider, createTestLogger());

    await cache.getToken();
    expect(callCount).toBe(1);

    // Advance past the proactive refresh margin (60s - 30s margin = 30s delay)
    await vi.advanceTimersByTimeAsync(31_000);

    expect(callCount).toBe(2);

    cache.dispose();
  });

  it('classifies ETIMEDOUT as transient error', async () => {
    const provider = makeProvider(async () => {
      throw new Error('connect ETIMEDOUT 10.0.0.1:443');
    });
    const cache = new TokenCache(provider, createTestLogger());

    await expect(cache.getToken()).rejects.toBeInstanceOf(TransientError);
  });

  it('classifies ENOTFOUND as transient error', async () => {
    const provider = makeProvider(async () => {
      throw new Error('getaddrinfo ENOTFOUND auth.example.com');
    });
    const cache = new TokenCache(provider, createTestLogger());

    await expect(cache.getToken()).rejects.toBeInstanceOf(TransientError);
  });

  it('classifies "network" keyword as transient error', async () => {
    const provider = makeProvider(async () => {
      throw new Error('network error occurred');
    });
    const cache = new TokenCache(provider, createTestLogger());

    await expect(cache.getToken()).rejects.toBeInstanceOf(TransientError);
  });

  it('classifies "unavailable" keyword as transient error', async () => {
    const provider = makeProvider(async () => {
      throw new Error('service unavailable');
    });
    const cache = new TokenCache(provider, createTestLogger());

    await expect(cache.getToken()).rejects.toBeInstanceOf(TransientError);
  });

  it('classifies non-transient errors as AuthenticationError', async () => {
    const provider = makeProvider(async () => {
      throw new Error('token revoked');
    });
    const cache = new TokenCache(provider, createTestLogger());

    await expect(cache.getToken()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('deduplicates concurrent getToken calls', async () => {
    let callCount = 0;
    const provider = makeProvider(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 10));
      return { token: `token-${callCount}` };
    });
    const cache = new TokenCache(provider, createTestLogger());

    const [t1, t2, t3] = await Promise.all([cache.getToken(), cache.getToken(), cache.getToken()]);
    expect(t1).toBe(t2);
    expect(t2).toBe(t3);
    expect(callCount).toBe(1);
  });

  it('proactive refresh logs error when provider fails', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const provider = makeProvider(async () => {
      callCount++;
      if (callCount === 2) throw new Error('refresh failed');
      return {
        token: `token-${callCount}`,
        expiresAt: new Date(Date.now() + 60_000),
      };
    });
    const logger = createTestLogger();
    const cache = new TokenCache(provider, logger);

    await cache.getToken();
    expect(callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(31_000);
    expect(callCount).toBe(2);
    expect(
      logger.entries.some(
        (e) => e.level === 'error' && e.msg.includes('Proactive token refresh failed'),
      ),
    ).toBe(true);

    cache.dispose();
  });

  it('immediate proactive refresh invalidates cache for next call', async () => {
    let callCount = 0;
    const provider = makeProvider(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          token: `token-${callCount}`,
          expiresAt: new Date(Date.now() + 5_000),
        };
      }
      return { token: `token-${callCount}` };
    });
    const cache = new TokenCache(provider, createTestLogger());

    const t1 = await cache.getToken();
    expect(t1).toBe('token-1');

    await new Promise((r) => setTimeout(r, 50));
    const t2 = await cache.getToken();
    expect(t2).toBe('token-2');
    expect(callCount).toBe(2);

    cache.dispose();
  });

  it('dispose prevents refresh timer from firing', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const provider = makeProvider(async () => {
      callCount++;
      return {
        token: `token-${callCount}`,
        expiresAt: new Date(Date.now() + 60_000),
      };
    });
    const cache = new TokenCache(provider, createTestLogger());

    await cache.getToken();
    expect(callCount).toBe(1);

    cache.dispose();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(callCount).toBe(1);
  });
});
