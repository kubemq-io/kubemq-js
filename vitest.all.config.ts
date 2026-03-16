import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/unit/**/*.test.ts', '__tests__/integration/**/*.integration.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/protos/**',
        'src/index.ts',
        'src/internal/transport/transport.ts',
        'src/internal/types.ts',
        'src/messages/subscription.ts',
      ],
    },
  },
});
