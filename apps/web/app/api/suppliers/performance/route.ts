/**
 * Supplier Performance API
 * Returns comprehensive supplier performance metrics and trends
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  // Fetch all suppliers from rate card suppliers with their rate cards
  const suppliers = await db.rateCardSupplier.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      rateCards: {
        select: {
          id: true,
          dailyRate: true,
          currency: true,
        },
      },
    },
  });

  // Calculate performance metrics for each supplier
  const supplierMetrics = suppliers.map((supplier) => {
    const totalRateCards = supplier.rateCards.length;

    const avgRate =
      totalRateCards > 0
        ? Math.round(
            supplier.rateCards.reduce((sum, rc) => sum + Number(rc.dailyRate), 0) /
              totalRateCards
          )
        : 0;

    // Performance metrics derived from available data
    const onTimeDelivery = null; // Requires delivery tracking integration
    const qualityScore = null; // Requires quality tracking integration
    const costEfficiency = avgRate > 0 ? Math.round(Math.min(100, (1000 / avgRate) * 100)) : null;
    const responsiveness = null; // Requires response tracking integration
    const overallScore = costEfficiency; // Only cost data currently available

    // Risk level based on contract volume (proxy metric)
    let riskLevel: 'low' | 'medium' | 'high';
    if (totalRateCards >= 3) {
      riskLevel = 'low';
    } else if (totalRateCards >= 1) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    const trend = 'stable' as const; // Requires historical data to compute

    return {
      id: supplier.id,
      name: supplier.name,
      overallScore,
      onTimeDelivery,
      qualityScore,
      costEfficiency,
      responsiveness,
      riskLevel,
      activeContracts: supplier.totalContracts,
      totalSpend: supplier.rateCards.reduce((sum, rc) => sum + Number(rc.dailyRate), 0),
      avgRate,
      trend,
    };
  });

  // Sort by overall score (descending)
  supplierMetrics.sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));

  // Trends require historical data tracking to compute
  const trends: { month: string; onTime: number | null; quality: number | null; cost: number | null }[] = [];

  return createSuccessResponse(ctx, {
    success: true,
    suppliers: supplierMetrics,
    trends,
  });
});
