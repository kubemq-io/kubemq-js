import { describe, it, expect } from 'vitest';
import { generateId } from '../../src/internal/utils/id.js';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('matches UUID v4 format', () => {
    expect(generateId()).toMatch(UUID_V4_RE);
  });

  it('generates unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
