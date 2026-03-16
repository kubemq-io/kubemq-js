import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    benchmark: {
      reporters: ['default', 'json'],
      outputFile: 'benchmarks/results/latest.json',
    },
    include: ['benchmarks/**/*.bench.ts'],
    testTimeout: 120_000,
  },
});
