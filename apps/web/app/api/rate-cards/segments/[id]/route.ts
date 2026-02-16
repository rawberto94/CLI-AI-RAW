import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { segmentManagementService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const segmentService = new segmentManagementService(prisma);

/**
 * GET /api/rate-cards/segments/[id]
 * Get a specific segment
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
try {
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const segment = await segmentService.getSegment(params.id, tenantId);

    return createSuccessResponse(ctx, segment);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Failed to get segment. Please try again.', 404);
  }
}

/**
 * PATCH /api/rate-cards/segments/[id]
 * Update a segment
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
try {
    const body = await request.json();
    
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }
    
    const userId = ctx.userId || 'system';

    const segment = await segmentService.updateSegment(
      params.id,
      tenantId,
      userId,
      {
        name: body.name,
        description: body.description,
        filters: body.filters,
        shared: body.shared,
      }
    );

    return createSuccessResponse(ctx, segment);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Failed to update segment. Please try again.', 400);
  }
}

/**
 * DELETE /api/rate-cards/segments/[id]
 * Delete a segment
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
try {
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }
    
    const userId = ctx.userId || 'system';

    await segmentService.deleteSegment(params.id, tenantId, userId);

    return createSuccessResponse(ctx, { success: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Failed to delete segment. Please try again.', 400);
  }
}
