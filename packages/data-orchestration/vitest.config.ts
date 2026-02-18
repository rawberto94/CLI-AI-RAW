import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    exclude: [
      'test/integration/**',
      'test/rate-card-ingestion.test.ts',
      'node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
    },
    testTimeout: 10000,
  },
});
