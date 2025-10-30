import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/rate-cards/dashboard/negotiation-metrics
 * Get negotiation status metrics for dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId') || 'default-tenant';

    // Get total negotiated rates
    const totalNegotiated = await prisma.rateCardEntry.count({
      where: {
        tenantId,
        isNegotiated: true,
      },
    });

    // Calculate success rate (simulated for now)
    // In production, this would track actual negotiation outcomes
    const successRate = 78.5; // Simulated 78.5% success rate

    // Get upcoming MSA renewals (next 90 days)
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    const upcomingRenewalsResult = await prisma.$queryRaw<Array<{
      clientName: string;
      msaReference: string;
      negotiationDate: Date;
      count: bigint;
    }>>`
      SELECT 
        "clientName",
        "msaReference",
        "negotiationDate",
        COUNT(*)::bigint as count
      FROM "RateCardEntry"
      WHERE "tenantId" = ${tenantId}
        AND "isNegotiated" = true
        AND "msaReference" IS NOT NULL
        AND "negotiationDate" IS NOT NULL
        AND "negotiationDate" + INTERVAL '1 year' <= ${ninetyDaysFromNow}
      GROUP BY "clientName", "msaReference", "negotiationDate"
      ORDER BY "negotiationDate" + INTERVAL '1 year' ASC
      LIMIT 10
    `;

    const upcomingRenewals = upcomingRenewalsResult.map((row) => ({
      clientName: row.clientName,
      msaReference: row.msaReference,
      renewalDate: new Date(new Date(row.negotiationDate).getTime() + 365 * 24 * 60 * 60 * 1000), // Add 1 year
      rateCardCount: Number(row.count),
    }));

    // Get recent negotiations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentNegotiationsResult = await prisma.$queryRaw<Array<{
      clientName: string;
      negotiationDate: Date;
      avgRate: number;
    }>>`
      SELECT 
        "clientName",
        "negotiationDate",
        AVG("dailyRate") as "avgRate"
      FROM "RateCardEntry"
      WHERE "tenantId" = ${tenantId}
        AND "isNegotiated" = true
        AND "negotiationDate" >= ${thirtyDaysAgo}
        AND "clientName" IS NOT NULL
      GROUP BY "clientName", "negotiationDate"
      ORDER BY "negotiationDate" DESC
      LIMIT 10
    `;

    const recentNegotiations = recentNegotiationsResult.map((row) => ({
      clientName: row.clientName,
      negotiationDate: row.negotiationDate,
      savingsPercentage: 12.5, // Simulated savings percentage
    }));

    // Count negotiation opportunities (rates above market median)
    const opportunitiesCount = Math.floor(totalNegotiated * 0.15); // Simulated 15% have opportunities

    return NextResponse.json({
      totalNegotiated,
      successRate,
      upcomingRenewals,
      recentNegotiations,
      opportunitiesCount,
    });
  } catch (error) {
    console.error('Error fetching negotiation metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch negotiation metrics', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
