import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';

// Helper to transform Prisma template to UI-expected format
function transformTemplate(template: Record<string, unknown>) {
  const metadata = (template.metadata || {}) as Record<string, unknown>
  const clauses = template.clauses as Array<Record<string, unknown>> || []
  const variables = (metadata.variables || []) as Array<Record<string, unknown>>
  
  return {
    ...template,
    status: metadata.status || (template.isActive ? 'active' : 'draft'),
    tags: metadata.tags || [],
    content: metadata.content || '',
    language: metadata.language || 'en-US',
    variables: variables.length,
    clauses: Array.isArray(clauses) ? clauses.length : (clauses || 0),
    lastModified: template.updatedAt,
    approvalStatus: metadata.approvalStatus || 'none',
    createdBy: template.createdBy || 'System',
  }
}

// POST /api/templates/[id]/duplicate - Duplicate a template
export async function POST(
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

    return createSuccessResponse(ctx, {
      success: true,
      template: transformTemplate(duplicate as unknown as Record<string, unknown>),
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
