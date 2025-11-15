import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;

    // Get all rate cards for this contract
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        contractId: id,
      },
      include: {
        supplier: true,
        benchmarkSnapshots: {
          take: 1,
          orderBy: {
            snapshotDate: 'desc',
          },
        },
      },
      orderBy: {
        dailyRateUSD: 'desc',
      },
    });

    // Calculate summary statistics
    const summary = {
      total: rateCards.length,
      avgRate: rateCards.length > 0
        ? rateCards.reduce((sum, r) => sum + Number(r.dailyRateUSD), 0) / rateCards.length
        : 0,
      minRate: rateCards.length > 0
        ? Math.min(...rateCards.map(r => Number(r.dailyRateUSD)))
        : 0,
      maxRate: rateCards.length > 0
        ? Math.max(...rateCards.map(r => Number(r.dailyRateUSD)))
        : 0,
      roles: [...new Set(rateCards.map(r => r.roleStandardized))].length,
      suppliers: [...new Set(rateCards.map(r => r.supplierName))].length,
    };

    return NextResponse.json({
      success: true,
      data: {
        rateCards,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Error fetching rate cards:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch rate cards',
      },
      { status: 500 }
    );
  }
}
