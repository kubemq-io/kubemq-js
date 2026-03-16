import { describe, it, expect } from 'vitest';
import { SDK_VERSION } from '../../src/version.js';

describe('version', () => {
  it('exports SDK_VERSION as a string', () => {
    expect(typeof SDK_VERSION).toBe('string');
    expect(SDK_VERSION.length).toBeGreaterThan(0);
  });

  it('follows semver format', () => {
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
