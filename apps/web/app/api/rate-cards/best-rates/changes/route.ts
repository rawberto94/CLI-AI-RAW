/**
 * Best Rate Changes API
 * 
 * Track and notify about changes in best rates
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

/**
 * GET /api/rate-cards/best-rates/changes
 * Get recent best rate changes for the tenant
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
    if (!ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const benchmarkEngine = new rateCardBenchmarkingService(prisma);
    const changes = await benchmarkEngine.trackBestRateChanges(ctx.tenantId);

    // Sort by absolute change percentage (most significant first)
    changes.sort((a, b) => Math.abs(b.changePercentage) - Math.abs(a.changePercentage));

    return createSuccessResponse(ctx, {
      changes,
      total: changes.length,
      summary: {
        improvements: changes.filter(c => c.changePercentage < 0).length,
        deteriorations: changes.filter(c => c.changePercentage > 0).length,
        totalAffectedRateCards: changes.reduce((sum, c) => sum + c.affectedRateCards, 0),
      },
    });
  });
