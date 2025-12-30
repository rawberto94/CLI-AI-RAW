/**
 * Bulk Benchmarking API
 * Endpoint for bulk benchmark calculation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardBenchmarkingEngine } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';
import { getErrorMessage, JsonRecord } from '@/lib/types/common';

const benchmarkingEngine = new RateCardBenchmarkingEngine(prisma);

/**
 * POST /api/benchmarking/bulk
 * Calculate benchmarks for all rate cards in a tenant
 * Body: { tenantId: string, forceRecalculate?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Run in background (don't await)
    const startTime = Date.now();
    
    const result: unknown = await benchmarkingEngine.calculateAllBenchmarks(tenantId);
    
    const duration = Date.now() - startTime;

    const resultRecord: JsonRecord =
      result !== null && typeof result === 'object' ? (result as JsonRecord) : {};

    return NextResponse.json({
      success: true,
      data: {
        ...resultRecord,
        duration: `${(duration / 1000).toFixed(2)}s`,
      },
    });
  } catch (error) {
    console.error('Error in bulk benchmark:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/benchmarking/bulk
 * Get status of bulk benchmarking
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
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

    return NextResponse.json({
      success: true,
      data: {
        total: rateCards.length,
        benchmarked,
        unbenchmarked,
        totalPotentialSavings: 0, // Calculated separately
        positionDistribution: {},
      },
    });
  } catch (error) {
    console.error('Error getting bulk status:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
