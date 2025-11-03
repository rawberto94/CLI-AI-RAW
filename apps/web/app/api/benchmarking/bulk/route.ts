/**
 * Bulk Benchmarking API
 * Endpoint for bulk benchmark calculation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardBenchmarkingEngine } from 'data-orchestration/services';

const benchmarkingEngine = new RateCardBenchmarkingEngine(prisma);

/**
 * POST /api/benchmarking/bulk
 * Calculate benchmarks for all rate cards in a tenant
 * Body: { tenantId: string, forceRecalculate?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Run in background (don't await)
    const startTime = Date.now();
    
    const result = await benchmarkingEngine.calculateAllBenchmarks(tenantId);
    
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        duration: `${(duration / 1000).toFixed(2)}s`,
      },
    });
  } catch (error: any) {
    console.error('Error in bulk benchmark:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to calculate bulk benchmarks',
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
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const rateCards = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: {
        id: true,
        benchmarkedAt: true,
        marketPosition: true,
        potentialSavings: true,
      },
    });

    const benchmarked = rateCards.filter(rc => rc.benchmarkedAt).length;
    const unbenchmarked = rateCards.length - benchmarked;

    const totalSavings = rateCards.reduce(
      (sum, rc) => sum + (rc.potentialSavings || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        total: rateCards.length,
        benchmarked,
        unbenchmarked,
        totalPotentialSavings: totalSavings,
        positionDistribution: rateCards.reduce((acc, rc) => {
          if (rc.marketPosition) {
            acc[rc.marketPosition] = (acc[rc.marketPosition] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error: any) {
    console.error('Error getting bulk status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get bulk status',
      },
      { status: 500 }
    );
  }
}
