import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId') || 'default-tenant';

    // Calculate total annual spend on rates
    const rateCards = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: {
        dailyRateUSD: true,
        volumeCommitted: true,
      },
    });

    const totalAnnualSpend = rateCards.reduce((sum, rate) => {
      const volume = rate.volumeCommitted || 0;
      const dailyRate = Number(rate.dailyRateUSD || 0);
      // Assuming 220 working days per year
      return sum + (dailyRate * volume * 220);
    }, 0);

    // Get total savings identified from opportunities
    const opportunities = await prisma.rateSavingsOpportunity.findMany({
      where: { tenantId },
      select: {
        annualSavingsPotential: true,
        status: true,
        actualSavingsRealized: true,
      },
    });

    const totalSavingsIdentified = opportunities.reduce(
      (sum, opp) => sum + Number(opp.annualSavingsPotential || 0),
      0
    );

    const totalSavingsRealized = opportunities.reduce(
      (sum, opp) => sum + Number(opp.actualSavingsRealized || 0),
      0
    );

    // Calculate average rate vs market
    const benchmarks = await prisma.benchmarkSnapshot.findMany({
      where: { tenantId },
      select: {
        rateValue: true,
        marketMedian: true,
      },
    });

    let avgRateVsMarket = 0;
    if (benchmarks.length > 0) {
      const totalDiff = benchmarks.reduce((sum, b) => {
        if (b.marketMedian && b.rateValue) {
          const diff = ((Number(b.rateValue) - Number(b.marketMedian)) / Number(b.marketMedian)) * 100;
          return sum + diff;
        }
        return sum;
      }, 0);
      avgRateVsMarket = totalDiff / benchmarks.length;
    }

    return NextResponse.json({
      totalAnnualSpend,
      totalSavingsIdentified,
      totalSavingsRealized,
      avgRateVsMarket,
      savingsRealizationRate: totalSavingsIdentified > 0 
        ? (totalSavingsRealized / totalSavingsIdentified) * 100 
        : 0,
    });
  } catch (error) {
    console.error('Error fetching financial metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial metrics' },
      { status: 500 }
    );
  }
}
