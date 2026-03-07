import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { rateCardBenchmarkingService } from 'data-orchestration/services';

/**
 * GET /api/rate-cards/comparisons
 * List saved comparisons for the tenant
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = ctx.tenantId;
    const _userId = searchParams.get('userId');

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

  const where: Record<string, unknown> = { tenantId };
    const comparisons = await prisma.rateComparison.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        targetRate: true,
      },
    });

    return createSuccessResponse(ctx, { comparisons });
  });

/**
 * POST /api/rate-cards/comparisons
 * Save a new comparison
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { name, description, rateCardIds, comparisonType, userId } = body;
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    if (!name || !rateCardIds || rateCardIds.length < 2) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Name and at least 2 rate card IDs are required', 400);
    }

    // Create the comparison
    const comparison = await prisma.rateComparison.create({
      data: {
        tenantId,
        comparisonName: name,
        comparisonType: comparisonType || 'CUSTOM',
        createdBy: userId || 'system',
        targetRateId: rateCardIds[0],
        comparisonRates: rateCardIds.slice(1),
        results: {},
        summary: description || '',
      },
      include: {
        targetRate: true,
      },
    });

    return createSuccessResponse(ctx, { comparison }, { status: 201 });
  });
