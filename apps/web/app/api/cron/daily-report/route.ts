import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'development-cron-secret';

/**
 * Generate Daily Contract Intelligence Report
 * 
 * This endpoint generates a daily summary of contract portfolio health.
 * 
 * Recommended schedule: Daily at 6 AM
 */

interface DailyReportData {
  date: string;
  portfolio: {
    totalContracts: number;
    activeContracts: number;
    totalValue: number;
  };
  health: {
    averageScore: number;
    critical: number;
    high: number;
    medium: number;
    healthy: number;
    improving: number;
    declining: number;
  };
  expirations: {
    expiredToday: number;
    expiringIn7Days: number;
    expiringIn30Days: number;
    expiringIn90Days: number;
    valueAtRisk: number;
  };
  alerts: {
    pendingCritical: number;
    pendingHigh: number;
    pendingTotal: number;
    sentToday: number;
  };
  actions: {
    renewalsPending: number;
    approvalsNeeded: number;
    reviewsOverdue: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '') || request.nextUrl.searchParams.get('secret');
    
    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    // Portfolio Overview
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: { notIn: ['DELETED', 'FAILED'] },
      },
      include: { contractMetadata: true },
    });

    const totalValue = contracts.reduce((sum, c) => {
      return sum + (Number(c.totalValue) || 0);
    }, 0);

    // Health Scores
    const healthScores = await prisma.contractHealthScore.findMany({
      where: { tenantId },
    });

    const healthStats = {
      averageScore: healthScores.length > 0 
        ? Math.round(healthScores.reduce((sum, h) => sum + h.overallScore, 0) / healthScores.length)
        : 0,
      critical: healthScores.filter(h => h.alertLevel === 'critical').length,
      high: healthScores.filter(h => h.alertLevel === 'high').length,
      medium: healthScores.filter(h => h.alertLevel === 'medium').length,
      healthy: healthScores.filter(h => h.alertLevel === 'healthy').length,
      improving: healthScores.filter(h => h.trendDirection === 'improving').length,
      declining: healthScores.filter(h => h.trendDirection === 'declining').length,
    };

    // Expirations
    const expirations = await prisma.contractExpiration.findMany({
      where: { tenantId },
    });

    const expirationStats = {
      expiredToday: expirations.filter(e => 
        e.daysUntilExpiry <= 0 && e.daysUntilExpiry > -1
      ).length,
      expiringIn7Days: expirations.filter(e => 
        e.daysUntilExpiry > 0 && e.daysUntilExpiry <= 7
      ).length,
      expiringIn30Days: expirations.filter(e => 
        e.daysUntilExpiry > 0 && e.daysUntilExpiry <= 30
      ).length,
      expiringIn90Days: expirations.filter(e => 
        e.daysUntilExpiry > 0 && e.daysUntilExpiry <= 90
      ).length,
      valueAtRisk: expirations
        .filter(e => e.daysUntilExpiry <= 90 && e.daysUntilExpiry > 0)
        .reduce((sum, e) => sum + (e.contractValue?.toNumber() || 0), 0),
    };

    // Alerts
    const pendingAlerts = await prisma.expirationAlert.groupBy({
      by: ['severity'],
      where: {
        tenantId,
        status: 'pending',
      },
      _count: { id: true },
    });

    const sentToday = await prisma.expirationAlert.count({
      where: {
        tenantId,
        status: 'sent',
        sentAt: { gte: todayStart },
      },
    });

    const alertStats = {
      pendingCritical: pendingAlerts.find(a => a.severity === 'critical')?._count.id || 0,
      pendingHigh: pendingAlerts.find(a => a.severity === 'high')?._count.id || 0,
      pendingTotal: pendingAlerts.reduce((sum, a) => sum + a._count.id, 0),
      sentToday,
    };

    // Actions Needed
    const renewalsPending = expirations.filter(e => 
      e.renewalStatus === 'PENDING' && e.daysUntilExpiry <= 90 && e.daysUntilExpiry > 0
    ).length;

    const report: DailyReportData = {
      date: new Date().toISOString().split('T')[0] ?? new Date().toISOString().substring(0, 10),
      portfolio: {
        totalContracts: contracts.length,
        activeContracts: contracts.filter(c => c.status === 'COMPLETED' || c.status === 'ACTIVE').length,
        totalValue,
      },
      health: healthStats,
      expirations: expirationStats,
      alerts: alertStats,
      actions: {
        renewalsPending,
        approvalsNeeded: 0, // Would integrate with approvals system
        reviewsOverdue: healthScores.filter(h => {
          const daysSinceCalculation = Math.floor(
            (now.getTime() - h.calculatedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysSinceCalculation > 30;
        }).length,
      },
    };

    // Store report (you could save to database or send via email)
    // Here you would:
    // 1. Store report in database for historical tracking
    // 2. Send email digest to admins/stakeholders
    // 3. Post to Slack/Teams
    // 4. Update dashboard cache

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Report generation failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  
  if (secret !== CRON_SECRET) {
    return NextResponse.json({
      success: true,
      message: 'Daily report cron endpoint is active',
      schedule: 'Daily at 6 AM recommended',
    });
  }

  return POST(request);
}
