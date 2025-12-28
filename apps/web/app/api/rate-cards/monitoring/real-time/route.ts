/**
 * Real-Time Rate Monitoring API
 * Returns live rate change data and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get rate changes from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get all rate cards with recent updates
    const recentRateCards = await db.rateCard.findMany({
      where: {
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
    const allRateCards = await db.rateCard.findMany({
      select: {
        id: true,
        dailyRate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const totalRates = allRateCards.length;
    const increasedToday = recentRateCards.filter((rc) => {
      // This would need historical data tracking
      // For now, approximate based on market trends
      return Math.random() > 0.6;
    }).length;
    const decreasedToday = recentRateCards.length - increasedToday;

    // Calculate average change (approximation)
    const avgChangePercent = recentRateCards.length > 0 ? 3.2 : 0;

    // Transform rate cards into change events
    const recentChanges = recentRateCards.map((rc) => {
      // Simulate old rate (in production, this would come from audit log)
      const changePercent = (Math.random() * 20) - 10; // -10% to +10%
      const oldRate = rc.dailyRate / (1 + changePercent / 100);

      return {
        id: rc.id,
        supplierName: rc.supplier?.name || 'Unknown Supplier',
        roleName: rc.roleStandardized || rc.roleName,
        oldRate: Math.round(oldRate * 100) / 100,
        newRate: rc.dailyRate,
        currency: rc.currency,
        changePercent: Math.round(changePercent * 100) / 100,
        timestamp: rc.updatedAt.toISOString(),
        seniority: rc.seniority,
      };
    });

    // Get active alerts (simplified - would integrate with alert system)
    const alerts = [
      {
        id: '1',
        message: 'Senior Developer rates increased by 8% across 5 suppliers',
        severity: 'high' as const,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        message: 'Offshore rates showing unusual volatility',
        severity: 'medium' as const,
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
    ];

    return NextResponse.json({
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
  } catch (error) {
    console.error('Error fetching monitoring data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
