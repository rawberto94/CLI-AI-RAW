/**
 * Market Intelligence API
 * Endpoints for market-wide rate intelligence
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';
import { getErrorMessage } from '@/lib/types/common';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
type BenchmarkCohortCriteria = Parameters<
  (typeof benchmarkingEngine)['calculateMarketIntelligence']
>[0];

const benchmarkingEngine = new rateCardBenchmarkingService(prisma);

/**
 * GET /api/benchmarking/market
 * Get market intelligence for specific criteria
 * Query params: role, seniority, country, lineOfService
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const searchParams = request.nextUrl.searchParams;

  const roleStandardized = searchParams.get('role');
  if (!roleStandardized) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Query param "role" is required', 400);
  }

  const criteria: BenchmarkCohortCriteria = {
    roleStandardized,
    seniority: searchParams.get('seniority') || undefined,
    country: searchParams.get('country') || undefined,
    lineOfService: searchParams.get('lineOfService') || undefined,
  };

  const intelligence = await benchmarkingEngine.calculateMarketIntelligence(criteria);

  return createSuccessResponse(ctx, {
    success: true,
    data: intelligence,
  });
});
