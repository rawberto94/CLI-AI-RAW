import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supplierBenchmarkService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id: supplierId } = await (ctx as any).params as { id: string };

  try {
    const { searchParams } = new URL(request.url);
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const benchmarkService = new supplierBenchmarkService(prisma);

    // Try to get latest benchmark first
    let scorecard = await benchmarkService.getLatestBenchmark(
      supplierId,
      ctx.tenantId
    );

    // If no recent benchmark, calculate new one
    if (!scorecard) {
      scorecard = await benchmarkService.calculateSupplierBenchmark({
        supplierId,
        tenantId: ctx.tenantId,
        periodMonths,
      });
    }

    // Get rate stability data
    const stability = await benchmarkService.trackRateStability(
      supplierId,
      ctx.tenantId,
      periodMonths
    );

    return createSuccessResponse(ctx, {
      scorecard,
      stability,
    });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch supplier scorecard', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id: supplierId } = await (ctx as any).params as { id: string };

  try {
    const body = await request.json();
    const periodMonths = body.periodMonths || 12;

    const benchmarkService = new supplierBenchmarkService(prisma);

    // Force recalculation
    const scorecard = await benchmarkService.calculateSupplierBenchmark({
      supplierId,
      tenantId: ctx.tenantId,
      periodMonths,
    });

    return createSuccessResponse(ctx, { scorecard });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to calculate supplier scorecard', 500);
  }
});
