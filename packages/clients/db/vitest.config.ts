import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    exclude: [
      'test/rate-card-ingestion.test.ts',
      'node_modules/**',
    ],
  },
});
