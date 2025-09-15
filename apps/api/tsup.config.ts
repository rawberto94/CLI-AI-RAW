import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['cjs'],
  target: 'node18',
  sourcemap: true,
  outDir: 'dist',
  external: [
    'tsconfig-paths/register',
    'utils',
    'clients-db',
    'clients-queue',
    'clients-storage',
    'agents',
    'schemas',
    'openai',
    'pdf-parse',
    '@prisma/client',
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    '@opentelemetry/auto-instrumentations-node',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    'pino',
    'pino-pretty'
  ],
  noExternal: []
});