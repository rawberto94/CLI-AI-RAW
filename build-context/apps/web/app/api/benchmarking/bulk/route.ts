/**
 * Bulk Benchmarking API
 * Endpoint for bulk benchmark calculation
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';
import { getErrorMessage, JsonRecord } from '@/lib/types/common';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

const benchmarkingEngine = new rateCardBenchmarkingService(prisma);

/**
 * POST /api/benchmarking/bulk
 * Calculate benchmarks for all rate cards in a tenant
 * Body: { tenantId: string, forceRecalculate?: boolean }
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID required', 400);
  }

  // Run in background (don't await)
  const startTime = Date.now();
  
  const result: unknown = await benchmarkingEngine.calculateAllBenchmarks(tenantId);
  
  const duration = Date.now() - startTime;

  const resultRecord: JsonRecord =
    result !== null && typeof result === 'object' ? (result as JsonRecord) : {};

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      ...resultRecord,
      duration: `${(duration / 1000).toFixed(2)}s`,
    },
  });
});

/**
 * GET /api/benchmarking/bulk
 * Get status of bulk benchmarking
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID required', 400);
  }

  const rateCards = await prisma.rateCardEntry.findMany({
    where: { tenantId },
    select: {
      id: true,
      lastBenchmarkedAt: true,
    },
  });

  const benchmarked = rateCards.filter(rc => rc.lastBenchmarkedAt).length;
  const unbenchmarked = rateCards.length - benchmarked;

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      total: rateCards.length,
      benchmarked,
      unbenchmarked,
      totalPotentialSavings: 0, // Calculated separately
      positionDistribution: {},
    },
  });
});
