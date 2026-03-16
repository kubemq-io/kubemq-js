import { bench, describe } from 'vitest';
import { generateId } from '../src/internal/utils/id.js';
import { randomUUID } from 'node:crypto';

describe('UUID generation', () => {
  bench('generateId() — SDK wrapper', () => {
    generateId();
  });

  bench('crypto.randomUUID() — direct call', () => {
    randomUUID();
  });

  bench('generateId() — batch of 100', () => {
    for (let i = 0; i < 100; i++) {
      generateId();
    }
  });
});
