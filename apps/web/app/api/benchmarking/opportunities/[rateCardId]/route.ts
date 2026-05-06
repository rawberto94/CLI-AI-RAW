/**
 * Savings Opportunities API
 * Endpoints for detecting and managing savings opportunities
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';
import { getErrorMessage } from '@/lib/types/common';
import { OpportunityStatus, type Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const benchmarkingEngine = new rateCardBenchmarkingService(prisma);

/**
 * POST /api/benchmarking/opportunities/:rateCardId
 * Detect savings opportunities for a specific rate card
 */
export const POST = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const { rateCardId } = await (ctx as any).params as { rateCardId: string };
    const tenantId = ctx.tenantId;

    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardId, tenantId },
    });

    if (!rateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found', 404);
    }

    const opportunities = await benchmarkingEngine.detectSavingsOpportunities(rateCardId);

    return createSuccessResponse(ctx, {
      success: true,
      data: opportunities,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})

/**
 * GET /api/benchmarking/opportunities
 * List all savings opportunities
 * Query params: tenantId, status, minSavings
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {

    const searchParams = request.nextUrl.searchParams;
    const tenantId = ctx.tenantId;
    const status = searchParams.get('status');
    const minSavings = searchParams.get('minSavings');

    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID required', 400);
    }

    const where: Prisma.RateSavingsOpportunityWhereInput = { tenantId };
    if (status && Object.values(OpportunityStatus).includes(status as OpportunityStatus)) {
      where.status = status as OpportunityStatus;
    }
    if (minSavings) where.annualSavingsPotential = { gte: parseFloat(minSavings) };

    const opportunities = await prisma.rateSavingsOpportunity.findMany({
      where,
      orderBy: { annualSavingsPotential: 'desc' },
      take: 100,
    });

    const totalSavings = opportunities.reduce(
      (sum, opp) => sum + Number(opp.annualSavingsPotential || 0),
      0
    );

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        opportunities,
        summary: {
          totalOpportunities: opportunities.length,
          totalPotentialSavings: totalSavings,
          byCategory: opportunities.reduce((acc, opp) => {
            acc[opp.category] = (acc[opp.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      },
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})
