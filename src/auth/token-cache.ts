import type { CredentialProvider } from './credential-provider.js';
import type { Logger } from '../logger.js';
import { KubeMQError, AuthenticationError, TransientError, ErrorCode } from '../errors.js';

interface CachedToken {
  token: string;
  expiresAt?: Date;
  fetchedAt: Date;
}

const PROACTIVE_REFRESH_MARGIN_MS = 30_000;

export class TokenCache {
  #cached: CachedToken | null = null;
  #pending: Promise<CachedToken> | null = null;
  #refreshTimer: ReturnType<typeof setTimeout> | null = null;
  readonly #provider: CredentialProvider;
  readonly #logger: Logger;

  constructor(provider: CredentialProvider, logger: Logger) {
    this.#provider = provider;
    this.#logger = logger;
  }

  async getToken(): Promise<string> {
    if (this.#cached && !this.#isExpired(this.#cached)) {
      return this.#cached.token;
    }
    return (await this.#fetchToken()).token;
  }

  get lastKnownToken(): string | undefined {
    if (this.#cached && !this.#isExpired(this.#cached)) {
      return this.#cached.token;
    }
    return undefined;
  }

  invalidate(): void {
    this.#cached = null;
    this.#cancelRefreshTimer();
    this.#logger.debug('Token cache invalidated');
  }

  dispose(): void {
    this.#cancelRefreshTimer();
    this.#cached = null;
    this.#pending = null;
  }

  async #fetchToken(): Promise<CachedToken> {
    if (this.#pending) {
      return this.#pending;
    }

    this.#pending = this.#doFetch();
    try {
      return await this.#pending;
    } finally {
      this.#pending = null;
    }
  }

  async #doFetch(): Promise<CachedToken> {
    this.#logger.debug('Fetching token from credential provider', {
      tokenPresent: !!this.#cached,
    });

    try {
      const { token, expiresAt } = await this.#provider.getToken();

      const cached: CachedToken = {
        token,
        expiresAt,
        fetchedAt: new Date(),
      };
      this.#cached = cached;

      if (expiresAt) {
        this.#scheduleProactiveRefresh(expiresAt);
      }

      this.#logger.debug('Token fetched successfully', {
        expiresAt: expiresAt?.toISOString(),
        tokenPresent: true,
      });

      return cached;
    } catch (err: unknown) {
      this.#logger.error('Token fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw this.#classifyProviderError(err);
    }
  }

  #isExpired(cached: CachedToken): boolean {
    if (!cached.expiresAt) return false;
    return Date.now() >= cached.expiresAt.getTime();
  }

  #scheduleProactiveRefresh(expiresAt: Date): void {
    this.#cancelRefreshTimer();

    const refreshAt = expiresAt.getTime() - PROACTIVE_REFRESH_MARGIN_MS;
    const delayMs = refreshAt - Date.now();

    if (delayMs <= 0) {
      this.#triggerProactiveRefresh();
      return;
    }

    this.#refreshTimer = setTimeout(() => {
      this.#triggerProactiveRefresh();
    }, delayMs);

    if (typeof this.#refreshTimer === 'object' && 'unref' in this.#refreshTimer) {
      this.#refreshTimer.unref();
    }
  }

  #triggerProactiveRefresh(): void {
    this.#logger.debug('Proactive token refresh triggered');
    this.#cached = null;
    this.#refreshTimer = null;
    this.#fetchToken().catch((err: unknown) => {
      this.#logger.error('Proactive token refresh failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  #cancelRefreshTimer(): void {
    if (this.#refreshTimer) {
      clearTimeout(this.#refreshTimer);
      this.#refreshTimer = null;
    }
  }

  #classifyProviderError(err: unknown): KubeMQError {
    if (err instanceof KubeMQError) return err;

    const error = err instanceof Error ? err : new Error(String(err));

    const isTransient =
      (err as Record<string, unknown>).isTransient === true ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('network') ||
      error.message.includes('unavailable');

    if (isTransient) {
      return new TransientError({
        code: ErrorCode.Unavailable,
        message: `Credential provider infrastructure error: ${error.message}`,
        operation: 'CredentialProvider.getToken',
        isRetryable: true,
        cause: error,
        suggestion: 'Check credential store connectivity.',
      });
    }

    return new AuthenticationError({
      code: ErrorCode.AuthFailed,
      message: `Credential provider error: ${error.message}`,
      operation: 'CredentialProvider.getToken',
      isRetryable: false,
      cause: error,
      suggestion: 'Check credential provider configuration and credential validity.',
    });
  }
}
