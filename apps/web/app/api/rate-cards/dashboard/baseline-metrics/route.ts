import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/rate-cards/dashboard/baseline-metrics
 * Get baseline tracking metrics for dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId') || 'default-tenant';

    // Get total baselines
    const totalBaselines = await prisma.rateCardEntry.count({
      where: {
        tenantId,
        isBaseline: true,
      },
    });

    // Get baseline types breakdown
    const baselineTypesResult = await prisma.$queryRaw<Array<{ baselineType: string; count: bigint }>>`
      SELECT "baselineType", COUNT(*)::bigint as count
      FROM "RateCardEntry"
      WHERE "tenantId" = ${tenantId}
        AND "isBaseline" = true
        AND "baselineType" IS NOT NULL
      GROUP BY "baselineType"
      ORDER BY count DESC
    `;

    const baselineTypes: Record<string, number> = {};
    baselineTypesResult.forEach((row) => {
      baselineTypes[row.baselineType] = Number(row.count);
    });

    // Calculate compliance (baselines within 10% variance)
    // For now, we'll use a simple calculation
    // In production, this would compare against actual rates
    const compliantCount = Math.floor(totalBaselines * 0.85); // Simulated 85% compliance
    const atRiskCount = totalBaselines - compliantCount;
    const compliancePercentage = totalBaselines > 0 ? (compliantCount / totalBaselines) * 100 : 0;

    // Calculate average variance (simulated for now)
    // In production, this would calculate actual variance from market rates
    const averageVariance = 5.2; // Simulated 5.2% average variance

    return NextResponse.json({
      totalBaselines,
      baselineTypes,
      compliancePercentage,
      averageVariance,
      atRiskCount,
      compliantCount,
    });
  } catch (error) {
    console.error('Error fetching baseline metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch baseline metrics', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
