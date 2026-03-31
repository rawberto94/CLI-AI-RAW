import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  // Keep workspace packages and heavy native modules external
  external: [
    // Workspace packages (installed via pnpm)
    'clients-db',
    'clients-openai',
    'schemas',
    // Heavy native modules
    '@prisma/client',
    'sharp',
    'canvas',
    // Runtime dependencies that should be installed
    'bullmq',
    'ioredis',
    'openai',
    'pino',
    'pino-pretty',
    'dotenv',
    '@aws-sdk/client-s3',
    '@mistralai/mistralai',
  ],
  // Environment variables to include
  env: {
    NODE_ENV: 'production',
  },
});
