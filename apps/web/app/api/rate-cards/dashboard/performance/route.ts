import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { rateCardBenchmarkingService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;

    // Require tenant ID for security
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    // Get all benchmarks for performance calculations
    const benchmarks = await prisma.benchmarkSnapshot.findMany({
      where: { tenantId },
      select: {
        rateValue: true,
        marketMedian: true,
        percentileRank: true,
      },
    });

    const totalRates = benchmarks.length;

    // Calculate percentage above market average
    const aboveMarket = benchmarks.filter(
      (b) => b.rateValue && b.marketMedian && b.rateValue > b.marketMedian
    ).length;
    const percentAboveMarket = totalRates > 0 ? (aboveMarket / totalRates) * 100 : 0;

    // Calculate percentage in top quartile (75th percentile or higher)
    const topQuartile = benchmarks.filter(
      (b) => b.percentileRank && b.percentileRank >= 75
    ).length;
    const percentTopQuartile = totalRates > 0 ? (topQuartile / totalRates) * 100 : 0;

    // Get negotiated rates
    const negotiatedRates = await prisma.rateCardEntry.count({
      where: {
        tenantId,
        isNegotiated: true,
      },
    });

    const totalRateCards = await prisma.rateCardEntry.count({
      where: { tenantId },
    });

    const percentNegotiated = totalRateCards > 0 
      ? (negotiatedRates / totalRateCards) * 100 
      : 0;

    // Calculate average savings per rate
    const opportunities = await prisma.rateSavingsOpportunity.findMany({
      where: { tenantId },
      select: {
        annualSavingsPotential: true,
      },
    });

    const totalSavings = opportunities.reduce(
      (sum, opp) => sum + Number(opp.annualSavingsPotential || 0),
      0
    );

    const avgSavingsPerRate = totalRateCards > 0 
      ? totalSavings / totalRateCards 
      : 0;

    return createSuccessResponse(ctx, {
      percentAboveMarket,
      percentTopQuartile,
      percentNegotiated,
      avgSavingsPerRate,
      totalRatesAnalyzed: totalRates,
    });
  });
