import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

// GET /api/templates/[id]/variables - Get template variables
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = await getApiTenantId(request);

    const { id: templateId } = await params;

    // Try to get variables from database
    try {
      const template = await prisma.contractTemplate.findFirst({
        where: {
          id: templateId,
          tenantId,
        },
        select: { 
          id: true, 
          metadata: true,
        },
      });

      if (template) {
        const metadata = template.metadata as Record<string, unknown> | null;
        const variables = metadata?.variables as unknown[];
        
        if (variables && Array.isArray(variables) && variables.length > 0) {
          return createSuccessResponse(ctx, { 
            variables,
            source: 'database'
          });
        }
      }
    } catch {
      // Database lookup failed
    }

    // No variables found for this template
    return createSuccessResponse(ctx, { 
      variables: [],
      source: 'database'
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// PUT /api/templates/[id]/variables - Update template variables
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates/variables', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const tenantId = await getApiTenantId(request);

    const { id: templateId } = await params;
    const body = await request.json();
    const { variables } = body;

    // Try to update in database
    try {
      const template = await prisma.contractTemplate.findFirst({
        where: {
          id: templateId,
          tenantId,
        },
        select: { metadata: true },
      });

      if (template) {
        const currentMetadata = (template.metadata as Record<string, unknown>) || {};
        
        await prisma.contractTemplate.update({
          where: { id: templateId },
          data: {
            metadata: {
              ...currentMetadata,
              variables,
            },
          },
        });

        await auditLog({
          action: AuditAction.CONTRACT_UPDATED,
          resourceType: 'template',
          resourceId: templateId,
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          metadata: { operation: 'update_variables' },
        }).catch(err => logger.error('[Template] Audit log failed', err));

        return createSuccessResponse(ctx, { 
          variables,
          source: 'database'
        });
      }

      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    } catch (dbError) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update template variables', 500);
    }
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// POST /api/templates/[id]/variables - Add a new variable
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates/variables', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const tenantId = await getApiTenantId(request);

    const { id: templateId } = await params;
    const body = await request.json();
    const { name, displayName, type, required = false, options, defaultValue, helpText } = body;

    const newVariable = {
      id: `v-${Date.now()}`,
      name,
      displayName,
      type,
      required,
      options,
      defaultValue,
      helpText,
    };

    // Try to add to database
    try {
      const template = await prisma.contractTemplate.findFirst({
        where: {
          id: templateId,
          tenantId,
        },
        select: { metadata: true },
      });

      if (template) {
        const currentMetadata = (template.metadata as Record<string, unknown>) || {};
        const existingVariables = (currentMetadata.variables as Record<string, unknown>[]) || [];
        
        await prisma.contractTemplate.update({
          where: { id: templateId },
          data: {
            metadata: JSON.parse(JSON.stringify({
              ...currentMetadata,
              variables: [...existingVariables, newVariable],
            })),
          },
        });

        await auditLog({
          action: AuditAction.CONTRACT_UPDATED,
          resourceType: 'template',
          resourceId: templateId,
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          metadata: { operation: 'add_variable' },
        }).catch(err => logger.error('[Template] Audit log failed', err));

        return createSuccessResponse(ctx, { 
          variable: newVariable,
          source: 'database'
        });
      }

      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    } catch (dbError) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to add template variable', 500);
    }
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
