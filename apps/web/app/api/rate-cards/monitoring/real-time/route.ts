/**
 * Real-Time Rate Monitoring API
 * Returns live rate change data and analytics
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (request, ctx) => {
    // Get rate changes from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get all rate card entries with recent updates
    const recentRateCardEntries = await db.rateCardEntry.findMany({
      where: {
        tenantId: ctx.tenantId,
        updatedAt: {
          gte: oneDayAgo,
        },
      },
      include: {
        supplier: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 20,
    });

    // Calculate summary statistics
    const allRateCardEntries = await db.rateCardEntry.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        id: true,
        dailyRate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const totalRates = allRateCardEntries.length;
    const increasedToday = 0; // Requires rate change history tracking
    const decreasedToday = 0; // Requires rate change history tracking

    // Average change requires historical rate tracking
    const avgChangePercent = 0;

    // Transform rate card entries into recent updates (without fake old rates)
    const recentChanges = recentRateCardEntries.map((rc) => {
      const dailyRateNum = Number(rc.dailyRate);

      return {
        id: rc.id,
        supplierName: rc.supplier?.name || rc.supplierName || 'Unknown Supplier',
        roleName: rc.roleStandardized || rc.roleOriginal,
        currentRate: dailyRateNum,
        currency: rc.currency,
        changePercent: null, // Requires historical rate tracking
        timestamp: rc.updatedAt.toISOString(),
        seniority: rc.seniority,
      };
    });

    // Alerts require an actual alert/threshold system
    const alerts: { id: string; message: string; severity: 'high' | 'medium' | 'low'; timestamp: string }[] = [];

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        recentChanges,
        summary: {
          totalRates,
          increasedToday,
          decreasedToday,
          avgChangePercent,
        },
        alerts,
      },
    });
  });
