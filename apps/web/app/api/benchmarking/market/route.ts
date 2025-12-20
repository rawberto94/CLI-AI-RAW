/**
 * Market Intelligence API
 * Endpoints for market-wide rate intelligence
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardBenchmarkingEngine } from 'data-orchestration/services';
import { getErrorMessage } from '@/lib/types/common';

interface MarketCriteria {
  role?: string;
  seniority?: string;
  country?: string;
  lineOfService?: string;
}

const benchmarkingEngine = new RateCardBenchmarkingEngine(prisma);

/**
 * GET /api/benchmarking/market
 * Get market intelligence for specific criteria
 * Query params: role, seniority, country, lineOfService
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const criteria = {
      role: searchParams.get('role') || undefined,
      seniority: searchParams.get('seniority') || undefined,
      country: searchParams.get('country') || undefined,
      lineOfService: searchParams.get('lineOfService') || undefined,
    };

    // Remove undefined values
    const cleanCriteria = Object.fromEntries(
      Object.entries(criteria).filter(([_, v]) => v !== undefined)
    );

    const intelligence = await benchmarkingEngine.calculateMarketIntelligence(cleanCriteria as MarketCriteria);

    return NextResponse.json({
      success: true,
      data: intelligence,
    });
  } catch (error) {
    console.error('Error getting market intelligence:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
