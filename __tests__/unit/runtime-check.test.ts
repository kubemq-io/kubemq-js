import { describe, it, expect, afterEach } from 'vitest';
import { assertNodeVersion } from '../../src/internal/runtime-check.js';

describe('assertNodeVersion', () => {
  const realVersion = process.version;

  afterEach(() => {
    Object.defineProperty(process, 'version', {
      value: realVersion,
      configurable: true,
      writable: true,
    });
  });

  it('does not throw on current Node.js version', () => {
    expect(() => assertNodeVersion()).not.toThrow();
  });

  it('throws for Node.js below minimum (major too low)', () => {
    Object.defineProperty(process, 'version', {
      value: 'v18.0.0',
      configurable: true,
      writable: true,
    });
    expect(() => assertNodeVersion()).toThrow('kubemq-js requires Node.js >= 20.11.0');
  });

  it('throws for Node.js below minimum (same major, minor too low)', () => {
    Object.defineProperty(process, 'version', {
      value: 'v20.10.0',
      configurable: true,
      writable: true,
    });
    expect(() => assertNodeVersion()).toThrow('kubemq-js requires Node.js >= 20.11.0');
  });

  it('does not throw for exact minimum version', () => {
    Object.defineProperty(process, 'version', {
      value: 'v20.11.0',
      configurable: true,
      writable: true,
    });
    expect(() => assertNodeVersion()).not.toThrow();
  });

  it('returns silently when process.version is not a string', () => {
    Object.defineProperty(process, 'version', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(() => assertNodeVersion()).not.toThrow();
  });

  it('returns silently for non-standard version string', () => {
    Object.defineProperty(process, 'version', {
      value: 'bun-1.0',
      configurable: true,
      writable: true,
    });
    expect(() => assertNodeVersion()).not.toThrow();
  });
});
