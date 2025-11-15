/**
 * Savings Opportunities API
 * Endpoints for detecting and managing savings opportunities
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardBenchmarkingEngine } from 'data-orchestration/services';

const benchmarkingEngine = new RateCardBenchmarkingEngine(prisma);

/**
 * POST /api/benchmarking/opportunities/:rateCardId
 * Detect savings opportunities for a specific rate card
 */
export async function POST(request: NextRequest, props: { params: Promise<{ rateCardId: string }> }) {
  const params = await props.params;
  try {
    const { rateCardId } = params;

    const opportunities = await benchmarkingEngine.detectSavingsOpportunities(rateCardId);

    return NextResponse.json({
      success: true,
      data: opportunities,
    });
  } catch (error: any) {
    console.error('Error detecting opportunities:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to detect opportunities',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/benchmarking/opportunities
 * List all savings opportunities
 * Query params: tenantId, status, minSavings
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');
    const minSavings = searchParams.get('minSavings');

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;
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

    return NextResponse.json({
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
  } catch (error: any) {
    console.error('Error getting opportunities:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get opportunities',
      },
      { status: 500 }
    );
  }
}
