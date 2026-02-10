import { NextRequest } from 'next/server';
/**
 * OpenAPI Specification for Contract Intelligence Platform
 * Auto-generated documentation for API endpoints
 * 
 * @endpoint GET /api/docs/openapi
 */

import { withApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

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
    { name: 'Signatures', description: 'E-signature workflows (DocuSign, Adobe Sign, internal)' },
    { name: 'Workflows', description: 'Approval and business process workflows' },
    { name: 'Portal', description: 'Supplier/external party self-service portal' },
    { name: 'Rate Cards', description: 'Rate card management' },
    { name: 'AI', description: 'AI-powered analysis endpoints' },
    { name: 'Analytics', description: 'Analytics and reporting' },
    { name: 'Export', description: 'Data export (CSV, XLSX, JSON, PDF)' },
    { name: 'Webhooks', description: 'Webhook configuration and delivery' },
    { name: 'Admin', description: 'Administration endpoints' },
    { name: 'Authentication', description: 'User authentication and MFA' },
    { name: 'Search', description: 'Full-text and semantic search' },
    { name: 'Templates', description: 'Contract template management' },
    { name: 'Obligations', description: 'Obligation tracking and alerts' },
    { name: 'Audit', description: 'Audit logging and compliance' },
    { name: 'GDPR', description: 'GDPR data rights management' },
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
    '/api/ai/chat/stream': {
      post: {
        tags: ['AI'],
        summary: 'AI Chat (Streaming)',
        description: 'Streaming AI chat with agentic function calling. Supports 18 tools (search, analytics, workflows, CRUD). Returns SSE events: content, tool_start, tool_done, done.',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  conversationId: { type: 'string' },
                  contractId: { type: 'string', format: 'uuid' },
                  provider: { type: 'string', enum: ['openai', 'anthropic'] },
                },
                required: ['message'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Server-sent events stream',
            content: { 'text/event-stream': { schema: { type: 'string' } } },
          },
        },
      },
    },
    '/api/signatures': {
      get: {
        tags: ['Signatures'],
        summary: 'List signature requests',
        description: 'Retrieve signature requests with optional filtering by contract or status',
        security: [{ session: [] }],
        parameters: [
          { name: 'contractId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'pending', 'sent', 'completed', 'declined', 'voided'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: {
          '200': { description: 'Paginated signature requests', content: { 'application/json': { schema: { $ref: '#/components/schemas/SignatureRequestList' } } } },
        },
      },
      post: {
        tags: ['Signatures'],
        summary: 'Create signature request',
        description: 'Create an e-signature request via DocuSign, Adobe Sign, or internal signing. Sends signing emails to all signatories.',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  contractId: { type: 'string', format: 'uuid' },
                  provider: { type: 'string', enum: ['docusign', 'adobe_sign', 'manual'], default: 'manual' },
                  signers: { type: 'array', items: { $ref: '#/components/schemas/Signer' } },
                  message: { type: 'string' },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
                required: ['contractId', 'signers'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Signature request created' },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/workflows': {
      get: {
        tags: ['Workflows'],
        summary: 'List workflows',
        description: 'Retrieve all workflow definitions for the tenant',
        security: [{ session: [] }],
        responses: {
          '200': { description: 'List of workflows' },
        },
      },
      post: {
        tags: ['Workflows'],
        summary: 'Create workflow',
        description: 'Create a new approval or business process workflow',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  triggerType: { type: 'string', enum: ['manual', 'auto', 'scheduled'] },
                  steps: { type: 'array', items: { $ref: '#/components/schemas/WorkflowStep' } },
                },
                required: ['name', 'steps'],
              },
            },
          },
        },
        responses: { '201': { description: 'Workflow created' } },
      },
    },
    '/api/portal': {
      get: {
        tags: ['Portal'],
        summary: 'Get portal data',
        description: 'Retrieve supplier portal data including contracts, pending tasks, and negotiation rounds. Supports magic-link token auth.',
        security: [{ session: [] }],
        parameters: [
          { name: 'token', in: 'query', schema: { type: 'string' }, description: 'Magic link token for external access' },
          { name: 'section', in: 'query', schema: { type: 'string', enum: ['contracts', 'tasks', 'negotiations'] } },
          { name: 'supplierId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Portal data' } },
      },
      post: {
        tags: ['Portal'],
        summary: 'Portal actions',
        description: 'Execute portal actions: sign contracts, upload documents, send messages, submit negotiation proposals',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['sign', 'upload', 'send-message', 'complete-task', 'submit-proposal', 'generate-magic-link'] },
                  contractId: { type: 'string', format: 'uuid' },
                  taskId: { type: 'string' },
                  message: { type: 'string' },
                  proposal: { type: 'object', description: 'Negotiation proposal with redlines' },
                },
                required: ['action'],
              },
            },
          },
        },
        responses: { '200': { description: 'Action completed' } },
      },
    },
    '/api/contracts/export': {
      post: {
        tags: ['Export'],
        summary: 'Export contracts',
        description: 'Export contracts in CSV, XLSX, JSON, or PDF format with configurable fields and filters',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  format: { type: 'string', enum: ['csv', 'xlsx', 'json', 'pdf'] },
                  includeFields: { type: 'array', items: { type: 'string' } },
                  contractIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                  filters: {
                    type: 'object',
                    properties: {
                      status: { type: 'array', items: { type: 'string' } },
                      dateRange: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } },
                    },
                  },
                },
                required: ['format', 'includeFields'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Export data or XLSX binary response' },
        },
      },
    },
    '/api/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhooks',
        security: [{ session: [] }],
        responses: { '200': { description: 'List of webhook configurations' } },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Create webhook',
        description: 'Register a webhook endpoint for event notifications (contract.created, signature.completed, workflow.approved, etc.)',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: { type: 'string', format: 'uri' },
                  events: { type: 'array', items: { type: 'string' } },
                  secret: { type: 'string' },
                },
                required: ['url', 'events'],
              },
            },
          },
        },
        responses: { '201': { description: 'Webhook created' } },
      },
    },
    '/api/search': {
      get: {
        tags: ['Search'],
        summary: 'Search contracts',
        description: 'Full-text and semantic search across contracts, clauses, and metadata using pgvector embeddings',
        security: [{ session: [] }],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['text', 'semantic', 'hybrid'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Search results with relevance scores' } },
      },
    },
    '/api/templates': {
      get: {
        tags: ['Templates'],
        summary: 'List contract templates',
        security: [{ session: [] }],
        responses: { '200': { description: 'List of templates' } },
      },
    },
    '/api/obligations': {
      get: {
        tags: ['Obligations'],
        summary: 'List obligations',
        description: 'Retrieve tracked obligations with deadline and compliance status',
        security: [{ session: [] }],
        responses: { '200': { description: 'List of obligations' } },
      },
    },
    '/api/audit-logs': {
      get: {
        tags: ['Audit'],
        summary: 'List audit logs',
        description: 'Retrieve immutable audit trail entries (7-year retention)',
        security: [{ session: [] }],
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'userId', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': { description: 'Paginated audit log entries' } },
      },
    },
    '/api/gdpr/export': {
      post: {
        tags: ['GDPR'],
        summary: 'Request data export',
        description: 'GDPR Article 20 - Request a portable data export for a user',
        security: [{ session: [] }],
        responses: { '202': { description: 'Export request accepted' } },
      },
    },
    '/api/gdpr/delete': {
      post: {
        tags: ['GDPR'],
        summary: 'Request data deletion',
        description: 'GDPR Article 17 - Request erasure of personal data',
        security: [{ session: [] }],
        responses: { '202': { description: 'Deletion request accepted' } },
      },
    },
    '/api/admin/api-keys': {
      get: {
        tags: ['Admin'],
        summary: 'List API keys',
        security: [{ session: [] }],
        responses: { '200': { description: 'List of API keys' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create API key',
        security: [{ session: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  permissions: { type: 'array', items: { type: 'string' } },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: { '201': { description: 'API key created (key shown once)' } },
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
      Signer: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['signer', 'approver', 'viewer', 'cc', 'witness'] },
          order: { type: 'integer' },
          status: { type: 'string', enum: ['pending', 'sent', 'viewed', 'signed', 'declined'] },
          signedAt: { type: 'string', format: 'date-time' },
        },
        required: ['name', 'email'],
      },
      SignatureRequestList: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              items: { type: 'array', items: { $ref: '#/components/schemas/SignatureRequest' } },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
        },
      },
      SignatureRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          contractId: { type: 'string', format: 'uuid' },
          provider: { type: 'string', enum: ['docusign', 'adobe_sign', 'manual'] },
          status: { type: 'string', enum: ['draft', 'pending', 'sent', 'completed', 'declined', 'voided'] },
          externalEnvelopeId: { type: 'string', description: 'DocuSign/Adobe envelope ID' },
          signers: { type: 'array', items: { $ref: '#/components/schemas/Signer' } },
          message: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      WorkflowStep: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['approval', 'review', 'signature', 'notification'] },
          assigneeId: { type: 'string' },
          order: { type: 'integer' },
          conditions: { type: 'object' },
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

export const GET = withApiHandler(async (_request: NextRequest, ctx) => {
  return createSuccessResponse(ctx, openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
