import { bench, describe } from 'vitest';

/**
 * Pure computation benchmark for exponential backoff with jitter.
 * Mirrors the logic in the SDK's retry engine.
 */

function computeBackoff(
  attempt: number,
  initialMs: number,
  maxMs: number,
  multiplier: number,
  jitter: 'full' | 'equal' | 'none',
): number {
  const raw = Math.min(initialMs * multiplier ** attempt, maxMs);
  switch (jitter) {
    case 'full':
      return Math.random() * raw;
    case 'equal': {
      const half = raw / 2;
      return half + Math.random() * half;
    }
    case 'none':
      return raw;
  }
}

describe('Retry backoff computation', () => {
  bench('Full jitter — attempt 0', () => {
    computeBackoff(0, 500, 30_000, 2.0, 'full');
  });

  bench('Full jitter — attempt 5', () => {
    computeBackoff(5, 500, 30_000, 2.0, 'full');
  });

  bench('Equal jitter — attempt 3', () => {
    computeBackoff(3, 500, 30_000, 2.0, 'equal');
  });

  bench('No jitter — attempt 3', () => {
    computeBackoff(3, 500, 30_000, 2.0, 'none');
  });

  bench('Backoff sequence — 10 attempts', () => {
    for (let i = 0; i < 10; i++) {
      computeBackoff(i, 500, 30_000, 2.0, 'full');
    }
  });
});
