import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

/**
 * GET /api/obligations/v2/metrics
 * Get comprehensive obligation metrics and analytics
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user?.tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = session.user.tenantId;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get all obligations
  const obligations = await prisma.obligation.findMany({
    where: { tenantId },
    include: {
      contract: {
        select: {
          id: true,
          contractTitle: true,
          supplier: { select: { name: true } },
        },
      },
    },
  });

  const totalObligations = obligations.length;

  // By Status
  const byStatus = {
    pending: obligations.filter((o) => o.status === 'PENDING').length,
    in_progress: obligations.filter((o) => o.status === 'IN_PROGRESS').length,
    completed: obligations.filter((o) => o.status === 'COMPLETED').length,
    overdue: obligations.filter(
      (o) => !['COMPLETED', 'CANCELLED', 'WAIVED'].includes(o.status) && o.dueDate && o.dueDate < now
    ).length,
    at_risk: obligations.filter((o) => o.status === 'AT_RISK').length,
    waived: obligations.filter((o) => o.status === 'WAIVED').length,
    cancelled: obligations.filter((o) => o.status === 'CANCELLED').length,
    disputed: obligations.filter((o) => o.status === 'DISPUTED').length,
  };

  // By Priority
  const byPriority = {
    critical: obligations.filter((o) => o.priority === 'CRITICAL').length,
    high: obligations.filter((o) => o.priority === 'HIGH').length,
    medium: obligations.filter((o) => o.priority === 'MEDIUM').length,
    low: obligations.filter((o) => o.priority === 'LOW').length,
  };

  // By Type
  const byType: Record<string, number> = {};
  obligations.forEach((o) => {
    const typeLower = o.type.toLowerCase();
    byType[typeLower] = (byType[typeLower] || 0) + 1;
  });

  // By Owner
  const byOwner = {
    us: obligations.filter((o) => o.owner === 'US').length,
    counterparty: obligations.filter((o) => o.owner === 'COUNTERPARTY').length,
    both: obligations.filter((o) => o.owner === 'BOTH').length,
    third_party: obligations.filter((o) => o.owner === 'THIRD_PARTY').length,
  };

  // Overdue count
  const overdueObligations = obligations.filter(
    (o) => !['COMPLETED', 'CANCELLED', 'WAIVED'].includes(o.status) && o.dueDate && o.dueDate < now
  );
  const overdueCount = overdueObligations.length;

  // At risk (due within 7 days)
  const atRiskObligations = obligations.filter(
    (o) =>
      !['COMPLETED', 'CANCELLED', 'WAIVED'].includes(o.status) &&
      o.dueDate &&
      o.dueDate >= now &&
      o.dueDate <= sevenDaysFromNow
  );
  const atRiskCount = atRiskObligations.length;

  // Due soon count
  const dueSoon = atRiskCount;

  // Completed this month
  const completedThisMonth = obligations.filter(
    (o) => o.status === 'COMPLETED' && o.completedAt && o.completedAt >= monthStart
  ).length;

  // Compliance rate
  const completedObligations = obligations.filter((o) => o.status === 'COMPLETED');
  const completedOnTime = completedObligations.filter(
    (o) => o.completedAt && o.dueDate && o.completedAt <= o.dueDate
  ).length;
  const complianceRate =
    completedObligations.length > 0
      ? Math.round((completedOnTime / completedObligations.length) * 100)
      : 100;

  // Average completion time
  let avgCompletionTime = 0;
  if (completedObligations.length > 0) {
    const totalDays = completedObligations.reduce((sum, o) => {
      if (o.completedAt && o.dueDate) {
        const days = Math.ceil(
          (o.completedAt.getTime() - o.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }
      return sum;
    }, 0);
    avgCompletionTime = Math.round(totalDays / completedObligations.length);
  }

  // Upcoming deadlines (next 30 days)
  const upcomingDeadlines = obligations
    .filter(
      (o) =>
        !['COMPLETED', 'CANCELLED', 'WAIVED'].includes(o.status) &&
        o.dueDate &&
        o.dueDate >= now &&
        o.dueDate <= thirtyDaysFromNow
    )
    .map((o) => ({
      obligationId: o.id,
      title: o.title,
      dueDate: o.dueDate!.toISOString(),
      daysRemaining: Math.ceil((o.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      contractId: o.contractId,
      contractName: o.contract?.contractTitle || 'Untitled Contract',
      vendorName: o.contract?.supplier?.name,
      priority: o.priority.toLowerCase(),
      type: o.type.toLowerCase(),
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 10);

  // Critical items (overdue critical/high priority)
  const criticalItems = overdueObligations
    .filter((o) => ['CRITICAL', 'HIGH'].includes(o.priority))
    .map((o) => ({
      obligationId: o.id,
      title: o.title,
      dueDate: o.dueDate!.toISOString(),
      daysOverdue: Math.ceil((now.getTime() - o.dueDate!.getTime()) / (1000 * 60 * 60 * 24)),
      contractId: o.contractId,
      contractName: o.contract?.contractTitle || 'Untitled Contract',
      priority: o.priority.toLowerCase(),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Risk score distribution
  const riskScores = obligations.filter((o) => o.riskScore !== null).map((o) => o.riskScore!);
  const avgRiskScore = riskScores.length > 0
    ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
    : 0;

  // Financial impact of overdue obligations
  const overdueFinancialImpact = overdueObligations
    .filter((o) => o.financialImpact)
    .reduce((sum, o) => sum + Number(o.financialImpact || 0), 0);

  // Trends (last 6 months)
  const trends: Array<{
    month: string;
    created: number;
    completed: number;
    overdue: number;
  }> = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthName = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });

    trends.push({
      month: monthName,
      created: obligations.filter((o) => o.createdAt >= monthDate && o.createdAt <= monthEnd).length,
      completed: obligations.filter(
        (o) => o.completedAt && o.completedAt >= monthDate && o.completedAt <= monthEnd
      ).length,
      overdue: obligations.filter(
        (o) =>
          o.dueDate &&
          o.dueDate >= monthDate &&
          o.dueDate <= monthEnd &&
          !['COMPLETED', 'CANCELLED', 'WAIVED'].includes(o.status)
      ).length,
    });
  }

  // By Contract (top 10)
  const byContract: Record<string, { count: number; overdue: number; contractTitle: string }> = {};
  obligations.forEach((o) => {
    if (!byContract[o.contractId]) {
      byContract[o.contractId] = {
        count: 0,
        overdue: 0,
        contractTitle: o.contract?.contractTitle || 'Untitled',
      };
    }
    byContract[o.contractId].count++;
    if (!['COMPLETED', 'CANCELLED', 'WAIVED'].includes(o.status) && o.dueDate && o.dueDate < now) {
      byContract[o.contractId].overdue++;
    }
  });

  const topContracts = Object.entries(byContract)
    .map(([contractId, data]) => ({ contractId, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return createSuccessResponse(ctx, {
    totalObligations,
    byStatus,
    byPriority,
    byType,
    byOwner,
    overdueCount,
    atRiskCount,
    dueSoon,
    completedThisMonth,
    complianceRate,
    avgCompletionTime,
    avgRiskScore,
    overdueFinancialImpact,
    upcomingDeadlines,
    criticalItems,
    trends,
    topContracts,
    generatedAt: now.toISOString(),
  });
});
