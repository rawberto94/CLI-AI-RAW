import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { segmentManagementService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const segmentService = new segmentManagementService(prisma);

/**
 * POST /api/rate-cards/segments/[id]/share
 * Share a segment with team members
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const _body = await request.json();
    
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }
    
    const userId = ctx.userId || 'system';

    const segment = await segmentService.shareSegment(params.id, tenantId, userId);

    return createSuccessResponse(ctx, segment);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Failed to share segment', details: error instanceof Error ? error.message : String(error), 400);
  }
}

/**
 * DELETE /api/rate-cards/segments/[id]/share
 * Unshare a segment
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }
    
    const userId = ctx.userId || 'system';

    const segment = await segmentService.unshareSegment(params.id, tenantId, userId);

    return createSuccessResponse(ctx, segment);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Failed to unshare segment', details: error instanceof Error ? error.message : String(error), 400);
  }
}
