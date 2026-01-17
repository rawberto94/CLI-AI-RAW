import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Rate trend data types
 */
interface RatePoint {
  date: Date | null;
  rate: number | null;
}

interface CategoryTrend {
  category: string;
  rates: RatePoint[];
  avgRate: number;
  count: number;
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');

    // Require tenant ID for security
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Get rate inflation by role category
    const ratesByCategory = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: {
        roleCategory: true,
        dailyRateUSD: true,
        effectiveDate: true,
      },
      orderBy: { effectiveDate: 'asc' },
    });

    // Group by role category and calculate trends
    const categoryTrends: Record<string, CategoryTrend> = {};
    
    ratesByCategory.forEach((rate) => {
      const category = rate.roleCategory || 'Uncategorized';
      if (!categoryTrends[category]) {
        categoryTrends[category] = {
          category,
          rates: [],
          avgRate: 0,
          count: 0,
        };
      }
      categoryTrends[category].rates.push({
        date: rate.effectiveDate,
        rate: Number(rate.dailyRateUSD),
      });
      categoryTrends[category].count++;
    });

    // Calculate average rates and trends
    const rateInflationByCategory = Object.values(categoryTrends).map((trend: CategoryTrend) => {
      const rates = trend.rates.sort((a: RatePoint, b: RatePoint) => 
        new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
      );
      
      const avgRate = rates.reduce((sum: number, r: RatePoint) => sum + (r.rate || 0), 0) / rates.length;
      
      // Calculate trend (compare first half vs second half)
      const midpoint = Math.floor(rates.length / 2);
      const firstHalf = rates.slice(0, midpoint);
      const secondHalf = rates.slice(midpoint);
      
      const firstAvg = firstHalf.reduce((sum: number, r: RatePoint) => sum + (r.rate || 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum: number, r: RatePoint) => sum + (r.rate || 0), 0) / secondHalf.length;
      
      const changePercent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
      
      return {
        category: trend.category,
        avgRate,
        changePercent,
        trend: changePercent > 2 ? 'UP' : changePercent < -2 ? 'DOWN' : 'STABLE',
        count: trend.count,
      };
    });

    // Get supplier competitiveness trends
    const supplierBenchmarks = await prisma.supplierBenchmark.findMany({
      where: { tenantId },
      select: {
        supplierId: true,
        competitivenessScore: true,
        averageRate: true,
        marketAverage: true,
      },
      orderBy: { competitivenessScore: 'desc' },
      take: 10,
    });

    // Get savings pipeline (opportunities by status)
    const savingsPipeline = await prisma.rateSavingsOpportunity.groupBy({
      by: ['status'],
      where: { tenantId },
      _sum: {
        annualSavingsPotential: true,
      },
      _count: true,
    });

    return NextResponse.json({
      rateInflationByCategory,
      supplierCompetitiveness: supplierBenchmarks,
      savingsPipeline: savingsPipeline.map((item) => ({
        status: item.status,
        totalSavings: item._sum.annualSavingsPotential || 0,
        count: item._count,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch trend data' },
      { status: 500 }
    );
  }
}
