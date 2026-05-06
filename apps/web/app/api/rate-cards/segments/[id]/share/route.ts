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
 * POST /api/rate-cards/segments/[id]/share
 * Share a segment with team members
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const _body = await request.json();
    
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    
    if (!tenantId || !userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const segment = await segmentService.shareSegment(id, tenantId, userId);

    return createSuccessResponse(ctx, segment);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Failed to share segment. Please try again.', 400);
  }
});

/**
 * DELETE /api/rate-cards/segments/[id]/share
 * Unshare a segment
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    
    if (!tenantId || !userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const segment = await segmentService.unshareSegment(id, tenantId, userId);

    return createSuccessResponse(ctx, segment);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Failed to unshare segment. Please try again.', 400);
  }
});
