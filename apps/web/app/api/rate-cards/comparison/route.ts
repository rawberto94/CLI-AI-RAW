/**
 * Rate Comparison API
 * Compares rates across suppliers and provides market benchmarking
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const suppliersParam = searchParams.get('suppliers');
    const rolesParam = searchParams.get('roles');
    const seniorityParam = searchParams.get('seniority');

    const supplierFilter = suppliersParam ? suppliersParam.split(',') : [];
    const roleFilter = rolesParam ? rolesParam.split(',') : [];

    // Fetch rate cards based on filters
    const rateCards = await db.rateCard.findMany({
      where: {
        ...(supplierFilter.length > 0
          ? {
              supplier: {
                name: { in: supplierFilter },
              },
            }
          : {}),
        ...(roleFilter.length > 0
          ? {
              OR: roleFilter.map((role) => ({
                OR: [
                  { roleName: { contains: role, mode: 'insensitive' } },
                  { roleStandardized: { contains: role, mode: 'insensitive' } },
                ],
              })),
            }
          : {}),
        ...(seniorityParam && seniorityParam !== 'all'
          ? { seniority: seniorityParam }
          : {}),
      },
      include: {
        supplier: {
          select: {
            name: true,
          },
        },
      },
    });

    // Group by supplier and role
    const groupedRates = new Map<string, { rates: number[]; supplier: string; role: string; seniority: string }>();

    rateCards.forEach((rc) => {
      const key = `${rc.supplier.name}|${rc.roleStandardized || rc.roleName}|${rc.seniority}`;
      
      if (!groupedRates.has(key)) {
        groupedRates.set(key, {
          rates: [],
          supplier: rc.supplier.name,
          role: rc.roleStandardized || rc.roleName,
          seniority: rc.seniority,
        });
      }
      
      groupedRates.get(key)!.rates.push(rc.dailyRate);
    });

    // Calculate comparisons
    const comparisons = Array.from(groupedRates.entries()).map(([key, data]) => {
      const currentRate = Math.round(data.rates.reduce((a, b) => a + b, 0) / data.rates.length);

      // Calculate market average for this role/seniority
      const marketRates = rateCards
        .filter((rc) => 
          (rc.roleStandardized === data.role || rc.roleName === data.role) &&
          rc.seniority === data.seniority
        )
        .map((rc) => rc.dailyRate);

      const avgMarketRate = marketRates.length > 0
        ? Math.round(marketRates.reduce((a, b) => a + b, 0) / marketRates.length)
        : currentRate;

      const difference = currentRate - avgMarketRate;
      const percentDiff = avgMarketRate > 0 ? ((difference / avgMarketRate) * 100) : 0;

      let trend: 'above' | 'below' | 'market';
      if (Math.abs(percentDiff) <= 2) {
        trend = 'market';
      } else if (percentDiff > 0) {
        trend = 'above';
      } else {
        trend = 'below';
      }

      return {
        supplier: data.supplier,
        role: data.role,
        seniority: data.seniority,
        currentRate,
        avgMarketRate,
        difference,
        percentDiff: Math.round(percentDiff * 10) / 10,
        trend,
      };
    });

    return NextResponse.json({
      success: true,
      comparisons,
    });
  } catch (error) {
    console.error('Error fetching rate comparisons:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch rate comparisons',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
