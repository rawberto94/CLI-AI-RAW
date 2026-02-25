/**
 * Agent Goal Detail API
 * 
 * Fetch a single agent goal with its steps and triggers.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, type AuthenticatedApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const GET = withAuthApiHandler(async (
  request: NextRequest,
  ctx: AuthenticatedApiContext
) => {
  try {
    const { tenantId } = ctx;
    // Extract id from the URL since withAuthApiHandler may not pass route params the same way
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    
    if (!id) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Goal ID required', 400);
    }

    const { prisma } = await import('@/lib/prisma');

    const goal = await prisma.agentGoal.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        triggers: true,
      },
    });

    if (!goal) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Goal not found', 404);
    }

    // Verify tenant ownership
    if (goal.tenantId !== tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Goal not found', 404);
    }

    return createSuccessResponse(ctx, goal);
  } catch (error) {
    logger.error('[Goal Detail] Error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch goal', 500);
  }
});
