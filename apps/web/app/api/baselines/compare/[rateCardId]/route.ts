/**
 * GET /api/baselines/compare/[rateCardId]
 * 
 * Compare rate card entry against baselines
 */

import { NextRequest, NextResponse } from 'next/server';
import { baselineManagementService } from 'data-orchestration';
import { prisma } from "@/lib/prisma";

// Using singleton prisma instance from @/lib/prisma

export async function GET(req: NextRequest, props: { params: Promise<{ rateCardId: string }> }) {
  const params = await props.params;
  try {

    const { rateCardId } = params;

    const service = new baselineManagementService(prisma);
    const comparisons = await service.compareAgainstBaselines(rateCardId);

    return NextResponse.json({
      success: true,
      rateCardId,
      comparisons,
      summary: {
        totalBaselines: comparisons.length,
        maxSavingsOpportunity: Math.max(...comparisons.map(c => (c as any).savingsOpportunity || 0), 0),
        aboveBaseline: comparisons.filter(c => c.status === 'ABOVE_BASELINE').length,
        atBaseline: comparisons.filter(c => c.status === 'AT_BASELINE').length,
        belowBaseline: comparisons.filter(c => c.status === 'BELOW_BASELINE').length,
      },
    });
  } catch (error) {
    console.error('Baseline comparison error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compare against baselines',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
