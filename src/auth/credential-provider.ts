import { ValidationError, ErrorCode } from '../errors.js';

/**
 * Pluggable credential provider interface for authentication.
 *
 * Implementations must be safe for concurrent invocation from
 * the event loop (the SDK serializes calls, but user code may not).
 *
 * The SDK caches the returned token and re-invokes the provider only when:
 * - No cached token exists
 * - The cached token is invalidated by a server UNAUTHENTICATED response
 * - Proactive refresh determines the token is approaching expiry
 *
 * At most one outstanding getToken() call is in flight at any time.
 */
export interface CredentialProvider {
  getToken(): Promise<{ token: string; expiresAt?: Date }>;
}

/**
 * Simple credential provider that returns a fixed authentication token.
 *
 * @remarks
 * Suitable for development or environments where tokens do not expire.
 * For production with rotating tokens, implement a custom {@link CredentialProvider}.
 *
 * Passing a plain string to {@link ClientOptions.credentials} automatically
 * wraps it in a `StaticTokenProvider`.
 *
 * @see {@link CredentialProvider}
 * @see {@link ClientOptions.credentials}
 */
export class StaticTokenProvider implements CredentialProvider {
  readonly #token: string;

  constructor(token: string) {
    if (!token) {
      throw new ValidationError({
        code: ErrorCode.ValidationFailed,
        message: 'Static token must not be empty',
        operation: 'StaticTokenProvider.constructor',
        isRetryable: false,
        suggestion: 'Provide a non-empty authentication token.',
      });
    }
    this.#token = token;
  }

  getToken(): Promise<{ token: string; expiresAt?: Date }> {
    return Promise.resolve({ token: this.#token });
  }

  toString(): string {
    return 'StaticTokenProvider { tokenPresent: true }';
  }

  toJSON(): Record<string, unknown> {
    return { type: 'StaticTokenProvider', tokenPresent: true };
  }
}

/**
 * Resolve credentials from ClientOptions into a CredentialProvider.
 * String values are auto-wrapped in StaticTokenProvider.
 */
export function resolveCredentialProvider(
  credentials: CredentialProvider | string | undefined,
): CredentialProvider | undefined {
  if (!credentials) return undefined;
  if (typeof credentials === 'string') {
    return new StaticTokenProvider(credentials);
  }
  return credentials;
}
