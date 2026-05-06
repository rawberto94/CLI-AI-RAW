import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { segmentManagementService } from 'data-orchestration/services';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';

const segmentService = new segmentManagementService(prisma);

/**
 * GET /api/rate-cards/segments/[id]
 * Get a specific segment
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const segment = await segmentService.getSegment(id, tenantId);

    return createSuccessResponse(ctx, segment);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Failed to get segment. Please try again.', 404);
  }
});

/**
 * PATCH /api/rate-cards/segments/[id]
 * Update a segment
 */
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const body = await request.json();

    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    
    if (!tenantId || !userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const segment = await segmentService.updateSegment(
      id,
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
});

/**
 * DELETE /api/rate-cards/segments/[id]
 * Delete a segment
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    
    if (!tenantId || !userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    await segmentService.deleteSegment(id, tenantId, userId);

    return createSuccessResponse(ctx, { success: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Failed to delete segment. Please try again.', 400);
  }
});
