/**
 * Savings vs Best Rate API
 * 
 * Calculate potential savings compared to the best rate in the market
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

/**
 * GET /api/rate-cards/[id]/savings-vs-best
 * Calculate savings vs best rate for a specific rate card entry
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id: rateCardId } = await (ctx as any).params as { id: string };

  try {
    if (!ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    // Verify rate card belongs to tenant
    const rateCard = await prisma.rateCardEntry.findFirst({
      where: {
        id: rateCardId,
        tenantId: ctx.tenantId,
      },
    });

    if (!rateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found', 404);
    }

    const benchmarkEngine = new rateCardBenchmarkingService(prisma);
    const savingsVsBest = await benchmarkEngine.calculateSavingsVsBest(rateCardId);

    return createSuccessResponse(ctx, savingsVsBest);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to calculate savings', 500);
  }
});
