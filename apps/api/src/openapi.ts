import { FastifyInstance } from 'fastify';

// Minimal OpenAPI 3.1 spec generator. Extend incrementally.
export function buildOpenAPISpec() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Contract Intelligence API',
      version: '0.1.0',
      description: 'Programmatic access to contract intelligence services.'
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local Dev' }
    ],
    paths: {
      '/healthz': {
        get: {
          summary: 'Liveness probe',
          responses: { '200': { description: 'Service healthy' } }
        }
      },
      '/readyz': {
        get: {
          summary: 'Readiness probe',
          responses: { '200': { description: 'Service ready' } }
        }
      }
    },
    components: {
      schemas: {}
    }
  } as const;
  return spec;
}

export async function registerOpenAPIRoute(app: FastifyInstance) {
  const spec = buildOpenAPISpec();
  app.get('/openapi.json', async () => spec);
}
