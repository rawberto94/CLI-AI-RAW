/**
 * Market Intelligence API
 * Endpoints for market-wide rate intelligence
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';
import { getErrorMessage } from '@/lib/types/common';

type BenchmarkCohortCriteria = Parameters<
  (typeof benchmarkingEngine)['calculateMarketIntelligence']
>[0];

const benchmarkingEngine = new rateCardBenchmarkingService(prisma);

/**
 * GET /api/benchmarking/market
 * Get market intelligence for specific criteria
 * Query params: role, seniority, country, lineOfService
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const roleStandardized = searchParams.get('role');
    if (!roleStandardized) {
      return NextResponse.json(
        { success: false, error: 'Query param "role" is required' },
        { status: 400 }
      );
    }
    
    const criteria: BenchmarkCohortCriteria = {
      roleStandardized,
      seniority: searchParams.get('seniority') || undefined,
      country: searchParams.get('country') || undefined,
      lineOfService: searchParams.get('lineOfService') || undefined,
    };

    const intelligence = await benchmarkingEngine.calculateMarketIntelligence(criteria);

    return NextResponse.json({
      success: true,
      data: intelligence,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
