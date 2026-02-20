import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // @ts-expect-error - React plugin types may not match vitest plugin types exactly
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'e2e/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'coverage/**',
      ],
      // Production-ready coverage thresholds
      thresholds: {
        // Global thresholds - start with achievable targets for pilot
        global: {
          statements: 40,
          branches: 30,
          functions: 35,
          lines: 40,
        },
        // Per-file thresholds for critical paths
        // These can be increased as coverage improves
        // 'lib/auth/**': {
        //   statements: 80,
        //   branches: 70,
        //   functions: 80,
        //   lines: 80,
        // },
        // 'lib/validation/**': {
        //   statements: 90,
        //   branches: 80,
        //   functions: 90,
        //   lines: 90,
        // },
      },
      // Report coverage even if below thresholds (for CI visibility)
      skipFull: false,
      // Generate a coverage summary
      all: true,
    },
    mockReset: true,
    // Add test timeout for flaky tests
    testTimeout: 10000,
    // Retry failed tests once
    retry: process.env.CI ? 1 : 0,
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
      'data-orchestration': path.resolve(__dirname, '../../packages/data-orchestration/src'),
      'schemas': path.resolve(__dirname, '../../packages/schemas/src'),
      '@repo/workers': path.resolve(__dirname, '../../packages/workers/src'),
      '@repo/agents': path.resolve(__dirname, '../../packages/agents/src'),
    },
  },
});
