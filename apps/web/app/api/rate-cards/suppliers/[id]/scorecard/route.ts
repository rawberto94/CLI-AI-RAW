import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supplierBenchmarkService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const supplierId = params.id;
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
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const supplierId = params.id;
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
}
