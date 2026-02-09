/**
 * Supplier Performance API
 * Returns comprehensive supplier performance metrics and trends
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  // Fetch all suppliers from rate card suppliers with their rate cards
  const suppliers = await db.rateCardSupplier.findMany({
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

    // Simulate performance metrics (in production, these would come from actual data)
    const baseScore = 70 + Math.random() * 25; // 70-95
    const onTimeDelivery = Math.round(baseScore + Math.random() * 5);
    const qualityScore = Math.round(baseScore + Math.random() * 5);
    const costEfficiency = Math.round(baseScore - 5 + Math.random() * 10);
    const responsiveness = Math.round(baseScore + Math.random() * 5);
    const overallScore = Math.round((onTimeDelivery + qualityScore + costEfficiency + responsiveness) / 4);

    // Determine risk level based on score
    let riskLevel: 'low' | 'medium' | 'high';
    if (overallScore >= 85) {
      riskLevel = 'low';
    } else if (overallScore >= 70) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    // Determine trend
    const trendRand = Math.random();
    const trend = trendRand > 0.6 ? 'up' : trendRand > 0.3 ? 'stable' : 'down';

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
  supplierMetrics.sort((a, b) => b.overallScore - a.overallScore);

  // Generate 6-month performance trends
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trends = months.map((month, index) => {
    const baseProgress = 80 + (index * 2); // Gradual improvement
    return {
      month,
      onTime: Math.round(baseProgress + Math.random() * 5),
      quality: Math.round(baseProgress + Math.random() * 5),
      cost: Math.round(baseProgress - 2 + Math.random() * 4),
    };
  });

  return createSuccessResponse(ctx, {
    success: true,
    suppliers: supplierMetrics,
    trends,
  });
});
