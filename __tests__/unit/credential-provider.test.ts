import { describe, it, expect } from 'vitest';
import {
  StaticTokenProvider,
  resolveCredentialProvider,
} from '../../src/auth/credential-provider.js';
import { ValidationError } from '../../src/errors.js';

describe('StaticTokenProvider', () => {
  it('returns the configured token', async () => {
    const provider = new StaticTokenProvider('my-token');
    const result = await provider.getToken();
    expect(result.token).toBe('my-token');
    expect(result.expiresAt).toBeUndefined();
  });

  it('returns same token on multiple calls', async () => {
    const provider = new StaticTokenProvider('test-token');
    const r1 = await provider.getToken();
    const r2 = await provider.getToken();
    expect(r1.token).toBe(r2.token);
  });

  it('rejects empty token string', () => {
    expect(() => new StaticTokenProvider('')).toThrow(ValidationError);
  });

  it('toString() does not leak the token value', () => {
    const provider = new StaticTokenProvider('secret-token');
    const str = provider.toString();
    expect(str).not.toContain('secret-token');
    expect(str).toContain('tokenPresent: true');
  });

  it('toJSON() does not leak the token value', () => {
    const provider = new StaticTokenProvider('secret-token');
    const json = provider.toJSON();
    expect(json).not.toHaveProperty('token');
    expect(json.tokenPresent).toBe(true);
    expect(json.type).toBe('StaticTokenProvider');
  });
});

describe('resolveCredentialProvider', () => {
  it('returns undefined for undefined input', () => {
    expect(resolveCredentialProvider(undefined)).toBeUndefined();
  });

  it('wraps string in StaticTokenProvider', async () => {
    const provider = resolveCredentialProvider('my-token');
    expect(provider).toBeDefined();
    const result = await provider!.getToken();
    expect(result.token).toBe('my-token');
  });

  it('passes through a CredentialProvider instance', async () => {
    const original = new StaticTokenProvider('token-123');
    const resolved = resolveCredentialProvider(original);
    expect(resolved).toBe(original);
  });
});
