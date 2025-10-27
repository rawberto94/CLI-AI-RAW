import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId') || 'default-tenant';

    // Get rate inflation by role category
    // @ts-ignore - Model will be added to schema
    const ratesByCategory = await prisma.rateCardEntry?.findMany({
      where: { tenantId },
      select: {
        roleCategory: true,
        dailyRateUSD: true,
        effectiveDate: true,
      },
      orderBy: { effectiveDate: 'asc' },
    }) || [];

    // Group by role category and calculate trends
    const categoryTrends: Record<string, any> = {};
    
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
        rate: rate.dailyRateUSD,
      });
      categoryTrends[category].count++;
    });

    // Calculate average rates and trends
    const rateInflationByCategory = Object.values(categoryTrends).map((trend: any) => {
      const rates = trend.rates.sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      const avgRate = rates.reduce((sum: number, r: any) => sum + (r.rate || 0), 0) / rates.length;
      
      // Calculate trend (compare first half vs second half)
      const midpoint = Math.floor(rates.length / 2);
      const firstHalf = rates.slice(0, midpoint);
      const secondHalf = rates.slice(midpoint);
      
      const firstAvg = firstHalf.reduce((sum: number, r: any) => sum + (r.rate || 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum: number, r: any) => sum + (r.rate || 0), 0) / secondHalf.length;
      
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
    // @ts-ignore - Model will be added to schema
    const supplierBenchmarks = await prisma.supplierBenchmark?.findMany({
      where: { tenantId },
      select: {
        supplierName: true,
        competitivenessScore: true,
        avgRateVsMarket: true,
      },
      orderBy: { competitivenessScore: 'desc' },
      take: 10,
    }) || [];

    // Get savings pipeline (opportunities by status)
    // @ts-ignore - Model will be added to schema
    const savingsPipeline = await prisma.rateSavingsOpportunity?.groupBy({
      by: ['status'],
      where: { tenantId },
      _sum: {
        annualSavingsPotential: true,
      },
      _count: true,
    }) || [];

    return NextResponse.json({
      rateInflationByCategory,
      supplierCompetitiveness: supplierBenchmarks,
      savingsPipeline: savingsPipeline.map((item) => ({
        status: item.status,
        totalSavings: item._sum.annualSavingsPotential || 0,
        count: item._count,
      })),
    });
  } catch (error) {
    console.error('Error fetching trend data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trend data' },
      { status: 500 }
    );
  }
}
