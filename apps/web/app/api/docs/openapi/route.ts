/**
 * OpenAPI Specification for Contract Intelligence Platform
 * Auto-generated documentation for API endpoints
 * 
 * @endpoint GET /api/docs/openapi
 */

import { NextResponse } from 'next/server';

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Contract Intelligence Platform API',
    description: `
API for the Contract Intelligence Platform - AI-powered contract analysis and management.

## Authentication
Most endpoints require authentication via session cookie (NextAuth) or API key.
Include the \`x-tenant-id\` header for multi-tenant operations.

## Rate Limiting
- Standard endpoints: 100 requests/minute
- AI endpoints: 10 requests/minute
- Upload endpoints: 20 requests/minute

## Error Responses
All errors follow the format:
\`\`\`json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
\`\`\`
    `,
    version: '2.0.0',
    contact: {
      name: 'API Support',
      url: 'https://github.com/rawberto94/CLI-AI-RAW',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '{protocol}://{host}',
      description: 'Current server',
      variables: {
        protocol: {
          enum: ['http', 'https'],
          default: 'https',
        },
        host: {
          default: 'localhost:3005',
        },
      },
    },
  ],
  tags: [
    { name: 'Health', description: 'System health and monitoring' },
    { name: 'Contracts', description: 'Contract management operations' },
    { name: 'Rate Cards', description: 'Rate card management' },
    { name: 'AI', description: 'AI-powered analysis endpoints' },
    { name: 'Authentication', description: 'User authentication' },
    { name: 'Analytics', description: 'Analytics and reporting' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Simple health check',
        description: 'Returns basic health status',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/monitoring/health': {
      get: {
        tags: ['Health'],
        summary: 'Detailed health check',
        description: 'Returns detailed health status including database, redis, and memory checks. Supports Kubernetes probes.',
        parameters: [
          {
            name: 'probe',
            in: 'query',
            description: 'Type of health probe',
            schema: {
              type: 'string',
              enum: ['liveness', 'readiness', 'startup'],
            },
          },
        ],
        responses: {
          '200': {
            description: 'Service is healthy or degraded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthCheck' },
              },
            },
          },
          '503': {
            description: 'Service is unhealthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthCheck' },
              },
            },
          },
        },
      },
    },
    '/api/monitoring/prometheus': {
      get: {
        tags: ['Health'],
        summary: 'Prometheus metrics',
        description: 'Returns metrics in Prometheus text format for scraping',
        responses: {
          '200': {
            description: 'Metrics in Prometheus format',
            content: {
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/api/contracts': {
      get: {
        tags: ['Contracts'],
        summary: 'List contracts',
        description: 'Retrieve a paginated list of contracts',
        security: [{ session: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'List of contracts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    contracts: { type: 'array', items: { $ref: '#/components/schemas/Contract' } },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    totalPages: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Contracts'],
        summary: 'Create contract',
        description: 'Create a new contract record',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContractCreate' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Contract created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Contract' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/contracts/{id}': {
      get: {
        tags: ['Contracts'],
        summary: 'Get contract',
        description: 'Retrieve a specific contract by ID',
        security: [{ session: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Contract details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Contract' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/contracts/upload': {
      post: {
        tags: ['Contracts'],
        summary: 'Upload contract file',
        description: 'Upload a contract document for processing (PDF, DOCX, images)',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  clientName: { type: 'string' },
                  category: { type: 'string' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upload successful, processing started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    contractId: { type: 'string', format: 'uuid' },
                    status: { type: 'string', example: 'PENDING' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '413': { description: 'File too large (max 100MB)' },
        },
      },
    },
    '/api/rate-cards': {
      get: {
        tags: ['Rate Cards'],
        summary: 'List rate cards',
        description: 'Retrieve a list of rate cards',
        security: [{ session: [] }],
        responses: {
          '200': {
            description: 'List of rate cards',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/RateCard' },
                },
              },
            },
          },
        },
      },
    },
    '/api/ai/chat': {
      post: {
        tags: ['AI'],
        summary: 'AI Chat',
        description: 'Send a message to the AI assistant for contract analysis',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', description: 'User message' },
                  contractId: { type: 'string', format: 'uuid', description: 'Optional contract context' },
                  history: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant'] },
                        content: { type: 'string' },
                      },
                    },
                  },
                },
                required: ['message'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'AI response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    response: { type: 'string' },
                    suggestions: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthCheck: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'integer', description: 'Uptime in seconds' },
          version: { type: 'string' },
          checks: {
            type: 'object',
            properties: {
              database: { $ref: '#/components/schemas/ComponentHealth' },
              redis: { $ref: '#/components/schemas/ComponentHealth' },
              memory: { $ref: '#/components/schemas/ComponentHealth' },
            },
          },
          responseTimeMs: { type: 'integer' },
        },
      },
      ComponentHealth: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['up', 'down', 'degraded'] },
          latencyMs: { type: 'integer' },
          message: { type: 'string' },
          details: { type: 'object' },
        },
      },
      Contract: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fileName: { type: 'string' },
          clientName: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
          category: { type: 'string' },
          totalValue: { type: 'number' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ContractCreate: {
        type: 'object',
        properties: {
          fileName: { type: 'string' },
          clientName: { type: 'string' },
          category: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
        },
        required: ['fileName'],
      },
      RateCard: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          supplierName: { type: 'string' },
          effectiveDate: { type: 'string', format: 'date' },
          expirationDate: { type: 'string', format: 'date' },
          entryCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Not found', code: 'NOT_FOUND' },
          },
        },
      },
      BadRequest: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
          },
        },
      },
    },
    securitySchemes: {
      session: {
        type: 'apiKey',
        in: 'cookie',
        name: 'next-auth.session-token',
        description: 'NextAuth session cookie',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key for programmatic access',
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
