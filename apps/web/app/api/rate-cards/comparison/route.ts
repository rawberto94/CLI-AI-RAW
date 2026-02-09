/**
 * Rate Comparison API
 * Compares rates across suppliers and provides market benchmarking
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const suppliersParam = searchParams.get('suppliers');
    const rolesParam = searchParams.get('roles');
    const seniorityParam = searchParams.get('seniority');

    const supplierFilter = suppliersParam ? suppliersParam.split(',') : [];
    const roleFilter = rolesParam ? rolesParam.split(',') : [];

    // Fetch rate card entries based on filters
    const rateCardEntries = await db.rateCardEntry.findMany({
      where: {
        ...(supplierFilter.length > 0
          ? {
              supplierName: { in: supplierFilter },
            }
          : {}),
        ...(roleFilter.length > 0
          ? {
              OR: roleFilter.map((role) => ({
                OR: [
                  { roleOriginal: { contains: role, mode: 'insensitive' as const } },
                  { roleStandardized: { contains: role, mode: 'insensitive' as const } },
                ],
              })),
            }
          : {}),
        ...(seniorityParam && seniorityParam !== 'all'
          ? { seniority: seniorityParam as any }
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

    rateCardEntries.forEach((rc) => {
      const key = `${rc.supplierName}|${rc.roleStandardized || rc.roleOriginal}|${rc.seniority}`;
      
      if (!groupedRates.has(key)) {
        groupedRates.set(key, {
          rates: [],
          supplier: rc.supplierName,
          role: rc.roleStandardized || rc.roleOriginal,
          seniority: rc.seniority,
        });
      }
      
      groupedRates.get(key)!.rates.push(Number(rc.dailyRate));
    });

    // Calculate comparisons
    const comparisons = Array.from(groupedRates.entries()).map(([_key, data]) => {
      const currentRate = Math.round(data.rates.reduce((a, b) => a + b, 0) / data.rates.length);

      // Calculate market average for this role/seniority
      const marketRates = rateCardEntries
        .filter((rc) => 
          (rc.roleStandardized === data.role || rc.roleOriginal === data.role) &&
          rc.seniority === data.seniority
        )
        .map((rc) => Number(rc.dailyRate));

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

    return createSuccessResponse(ctx, {
      success: true,
      comparisons,
    });
  });
