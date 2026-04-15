import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { transformTemplateRecord } from '@/lib/templates/template-record';

// GET /api/templates/[id] - Get a single template
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
    const { id } = await params;

    // Handle "new" route - return empty template structure
    if (id === 'new') {
      return createSuccessResponse(ctx, {
        success: true,
        template: null,
        isNew: true,
      });
    }

    const template = await prisma.contractTemplate.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!template) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    return createSuccessResponse(ctx, {
      success: true,
      template: transformTemplateRecord(template as unknown as Record<string, unknown>, true),
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// PUT /api/templates/[id] - Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const tenantId = await getApiTenantId(request);
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      description,
      category,
      clauses,
      structure,
      metadata,
      content,
      status,
      tags,
      variables,
      isActive,
    } = body;

    // Check if template exists and belongs to tenant
    const existingTemplate = await prisma.contractTemplate.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingTemplate) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (clauses !== undefined) updateData.clauses = clauses;
    if (structure !== undefined) updateData.structure = structure;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Merge metadata
    if (metadata !== undefined || content !== undefined || status !== undefined || tags !== undefined || variables !== undefined) {
      const existingMetadata = (existingTemplate.metadata as Record<string, unknown>) || {};
      updateData.metadata = {
        ...existingMetadata,
        ...(metadata || {}),
        ...(content !== undefined ? { content } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(variables !== undefined ? { variables } : {}),
        updatedBy: ctx.userId,
        updatedAt: new Date().toISOString(),
      };
    }

    const template = await prisma.contractTemplate.update({
      where: { id },
      data: updateData,
    });

    await auditLog({
      action: AuditAction.CONTRACT_UPDATED,
      resourceType: 'template',
      resourceId: template.id,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      metadata: { operation: 'update', title: template.name },
    }).catch(err => logger.error('[Template] Audit log failed', err));

    return createSuccessResponse(ctx, {
      success: true,
      template: transformTemplateRecord(template as unknown as Record<string, unknown>),
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const tenantId = await getApiTenantId(request);
    const { id } = await params;

    // Check if template exists and belongs to tenant
    const existingTemplate = await prisma.contractTemplate.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingTemplate) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    // Delete the template
    await prisma.contractTemplate.delete({
      where: { id },
    });

    await auditLog({
      action: AuditAction.CONTRACT_DELETED,
      resourceType: 'template',
      resourceId: id,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      metadata: { operation: 'delete', title: existingTemplate.name },
    }).catch(err => logger.error('[Template] Audit log failed', err));

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
