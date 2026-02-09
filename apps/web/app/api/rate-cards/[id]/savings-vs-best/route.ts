/**
 * Savings vs Best Rate API
 * 
 * Calculate potential savings compared to the best rate in the market
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * GET /api/rate-cards/[id]/savings-vs-best
 * Calculate savings vs best rate for a specific rate card entry
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    if (!ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const rateCardId = params.id;

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
    return createErrorResponse(ctx, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to calculate savings', 500);
  }
}
