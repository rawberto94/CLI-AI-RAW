import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BaselineManagementService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    // Mock user for now - in production, get from session
    const mockTenantId = 'tenant-1';

    const baselineService = new BaselineManagementService(prisma);

    // Get baseline statistics
    const stats = await baselineService.getBaselineStatistics(mockTenantId);

    // Get rates exceeding baselines
    const exceedingRates = await baselineService.bulkCompareAgainstBaselines(
      mockTenantId,
      { minVariancePercentage: 0 }
    );

    // Calculate achievement metrics
    const totalRateCards = exceedingRates.totalEntries;
    const ratesWithinBaseline = totalRateCards - exceedingRates.entriesWithMatches;
    const achievementRate = totalRateCards > 0 
      ? (ratesWithinBaseline / totalRateCards) * 100 
      : 0;

    // Calculate savings metrics
    const totalSavingsIdentified = exceedingRates.totalSavingsOpportunity;
    const totalSavingsRealized = 0; // Will be tracked when comparisons are implemented

    // Get top baseline violations
    const topViolations = exceedingRates.comparisons
      .slice(0, 10)
      .map(comp => ({
        entryId: comp.entryId,
        resourceType: comp.resourceType,
        lineOfService: comp.lineOfService,
        actualRate: comp.actualRate,
        maxSavings: comp.maxSavings,
        comparisons: comp.comparisons,
      }));

    // Track baseline performance over time
    const performanceByType = stats.byType.map(type => ({
      type: type.type,
      count: type.count,
      avgRate: type.avgRate,
    }));

    return NextResponse.json({
      summary: {
        totalBaselines: stats.totalBaselines,
        activeBaselines: stats.activeBaselines,
        totalRateCards,
        ratesWithinBaseline,
        ratesExceedingBaseline: exceedingRates.entriesWithMatches,
        achievementRate: Math.round(achievementRate * 10) / 10,
        totalSavingsIdentified,
        totalSavingsRealized,
      },
      byType: performanceByType,
      byCategory: stats.byCategory,
      topViolations,
      recentComparisons: [], // Will be populated when comparison records are tracked
    });
  } catch (error) {
    console.error('Error fetching baseline tracking data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch baseline tracking data' },
      { status: 500 }
    );
  }
}
