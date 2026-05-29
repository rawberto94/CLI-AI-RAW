import { NextRequest } from 'next/server';
import { withCronHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringService } from 'data-orchestration/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generate Daily Contract Intelligence Report
 *
 * This endpoint generates a daily summary of contract portfolio health.
 * If tenantId is provided via query param, reports for that tenant only.
 * Otherwise, iterates all active tenants.
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

async function generateReportForTenant(tenantId: string): Promise<DailyReportData> {
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

  return {
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
}

export const POST = withCronHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (tenantId) {
      const report = await generateReportForTenant(tenantId);
      return createSuccessResponse(ctx, { data: report, tenantId });
    }

    // Iterate all active tenants
    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    const results: Array<{ tenantId: string; tenantName: string | null; report: DailyReportData }> = [];
    const errors: Array<{ tenantId: string; error: string }> = [];

    for (const tenant of tenants) {
      try {
        const report = await generateReportForTenant(tenant.id);
        results.push({ tenantId: tenant.id, tenantName: tenant.name, report });
      } catch (err) {
        errors.push({ tenantId: tenant.id, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return createSuccessResponse(ctx, {
      data: {
        tenantsProcessed: results.length,
        errors: errors.length,
        results,
        failed: errors,
      },
    });
});

export const GET = withCronHandler(async (request, ctx) => {
  return POST(request);
});
