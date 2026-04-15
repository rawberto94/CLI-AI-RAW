import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { transformTemplateRecord } from '@/lib/templates/template-record';

// POST /api/templates/[id]/duplicate - Duplicate a template
export async function POST(
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
    const body = await request.json().catch(() => ({}));

    // Find the original template
    const original = await prisma.contractTemplate.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!original) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    // Generate unique name - append timestamp if name already exists
    let newName = body.name || `${original.name} (Copy)`;
    
    // Check if name already exists and make unique
    const existingWithName = await prisma.contractTemplate.findFirst({
      where: {
        tenantId,
        name: newName,
      },
    });
    
    if (existingWithName) {
      // Append timestamp to make unique
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      newName = `${newName} ${timestamp}`;
    }

    // Create duplicate
    const originalMetadata = (original.metadata as Record<string, unknown>) || {};
    const duplicate = await prisma.contractTemplate.create({
      data: {
        tenantId,
        name: newName,
        description: original.description,
        category: original.category,
        clauses: original.clauses as object,
        structure: original.structure as object,
        metadata: {
          ...originalMetadata,
          status: 'draft', // Duplicates start as draft
          duplicatedFrom: original.id,
          duplicatedAt: new Date().toISOString(),
        },
        version: 1,
        isActive: false, // Duplicates start as inactive/draft
        usageCount: 0,
        createdBy: ctx.userId,
      },
    });

    await auditLog({
      action: AuditAction.CONTRACT_CREATED,
      resourceType: 'template',
      resourceId: duplicate.id,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      metadata: { operation: 'duplicate', sourceId: id },
    }).catch(err => logger.error('[Template] Audit log failed', err));

    return createSuccessResponse(ctx, {
      success: true,
      template: transformTemplateRecord(duplicate as unknown as Record<string, unknown>),
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
