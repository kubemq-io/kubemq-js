import { describe, it, expect, vi } from 'vitest';
import {
  parseVersion,
  versionSatisfiesRange,
  checkServerCompatibility,
} from '../../src/internal/version-check.js';

describe('parseVersion', () => {
  it('parses "1.2.3"', () => {
    const v = parseVersion('1.2.3');
    expect(v).toEqual({ major: 1, minor: 2, patch: 3, raw: '1.2.3' });
  });

  it('parses "v1.2.3" with leading v', () => {
    const v = parseVersion('v1.2.3');
    expect(v).toEqual({ major: 1, minor: 2, patch: 3, raw: 'v1.2.3' });
  });

  it('parses "1.2.3-beta" ignoring pre-release suffix', () => {
    const v = parseVersion('1.2.3-beta');
    expect(v).toEqual({ major: 1, minor: 2, patch: 3, raw: '1.2.3-beta' });
  });

  it('returns undefined for invalid input "abc"', () => {
    expect(parseVersion('abc')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseVersion('')).toBeUndefined();
  });
});

describe('versionSatisfiesRange', () => {
  it('returns true when major > minMajor', () => {
    expect(versionSatisfiesRange({ major: 4, minor: 0, patch: 0, raw: '4.0.0' }, 3, 0)).toBe(true);
  });

  it('returns true when major === minMajor and minor >= minMinor', () => {
    expect(versionSatisfiesRange({ major: 3, minor: 0, patch: 0, raw: '3.0.0' }, 3, 0)).toBe(true);
    expect(versionSatisfiesRange({ major: 3, minor: 5, patch: 0, raw: '3.5.0' }, 3, 0)).toBe(true);
  });

  it('returns false when major < minMajor', () => {
    expect(versionSatisfiesRange({ major: 2, minor: 9, patch: 9, raw: '2.9.9' }, 3, 0)).toBe(false);
  });

  it('returns false when major === minMajor but minor < minMinor', () => {
    expect(versionSatisfiesRange({ major: 3, minor: 0, patch: 0, raw: '3.0.0' }, 3, 1)).toBe(false);
  });
});

describe('checkServerCompatibility', () => {
  function createMockLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }

  it('does not warn for a compatible version', () => {
    const logger = createMockLogger();
    checkServerCompatibility('3.0.0', logger);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns when server version is below tested range', () => {
    const logger = createMockLogger();
    checkServerCompatibility('2.5.0', logger);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('below the minimum tested version'),
      expect.any(Object),
    );
  });

  it('warns when version string is unparseable', () => {
    const logger = createMockLogger();
    checkServerCompatibility('not-a-version', logger);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not parse server version'),
      expect.objectContaining({ serverVersion: 'not-a-version' }),
    );
  });

  it('does not warn for a version above the range', () => {
    const logger = createMockLogger();
    checkServerCompatibility('4.1.0', logger);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
