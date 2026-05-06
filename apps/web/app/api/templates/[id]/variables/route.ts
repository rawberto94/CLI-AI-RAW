import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

// GET /api/templates/[id]/variables - Get template variables
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  const { id: templateId } = await (ctx as any).params as { id: string };

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
})

// PUT /api/templates/[id]/variables - Update template variables
export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates/variables', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  const tenantId = ctx.tenantId;

  const { id: templateId } = await (ctx as any).params as { id: string };
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
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update template variables', 500);
  }
})

// POST /api/templates/[id]/variables - Add a new variable
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates/variables', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  const tenantId = ctx.tenantId;

  const { id: templateId } = await (ctx as any).params as { id: string };
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
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to add template variable', 500);
  }
})
