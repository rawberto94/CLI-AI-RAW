import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * GET /api/obligations/metrics
 * Get obligation dashboard metrics
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user?.tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch all contracts with obligations
  const contracts = await prisma.contract.findMany({
    where: { tenantId: session.user.tenantId },
    select: {
      id: true,
      contractTitle: true,
      metadata: true,
      supplier: { select: { name: true } },
    },
  });

  // Aggregate all obligations
  const allObligations: Array<{
    id: string;
    contractId: string;
    contractTitle: string;
    vendorName?: string;
    status: string;
    type: string;
    priority: string;
    owner: string;
    dueDate: Date;
    title: string;
    completedAt?: Date;
    createdAt?: string;
  }> = [];

  contracts.forEach((contract) => {
    const meta = contract.metadata as Record<string, unknown> | null;
    const obligations = (meta?.obligations as unknown[]) || [];

    obligations.forEach((obl: unknown) => {
      const o = obl as Record<string, unknown>;
      allObligations.push({
        id: o.id as string,
        contractId: contract.id,
        contractTitle: contract.contractTitle || 'Untitled',
        vendorName: contract.supplier?.name,
        status: o.status as string,
        type: o.type as string,
        priority: o.priority as string,
        owner: o.owner as string,
        dueDate: new Date(o.dueDate as string),
        title: o.title as string,
        completedAt: o.completedAt ? new Date(o.completedAt as string) : undefined,
        createdAt: o.createdAt as string,
      });
    });
  });

  // Calculate metrics
  const totalObligations = allObligations.length;

  // By Status
  const byStatus = {
    pending: allObligations.filter((o) => o.status === 'pending').length,
    in_progress: allObligations.filter((o) => o.status === 'in_progress').length,
    completed: allObligations.filter((o) => o.status === 'completed').length,
    overdue: allObligations.filter(
      (o) => !['completed', 'cancelled', 'waived'].includes(o.status) && o.dueDate < now
    ).length,
    at_risk: allObligations.filter((o) => o.status === 'at_risk').length,
    waived: allObligations.filter((o) => o.status === 'waived').length,
    cancelled: allObligations.filter((o) => o.status === 'cancelled').length,
  };

  // By Priority
  const byPriority = {
    critical: allObligations.filter((o) => o.priority === 'critical').length,
    high: allObligations.filter((o) => o.priority === 'high').length,
    medium: allObligations.filter((o) => o.priority === 'medium').length,
    low: allObligations.filter((o) => o.priority === 'low').length,
  };

  // By Type
  const byType: Record<string, number> = {};
  allObligations.forEach((o) => {
    if (o.type) {
      byType[o.type] = (byType[o.type] || 0) + 1;
    }
  });

  // By Owner
  const byOwner = {
    us: allObligations.filter((o) => o.owner === 'us').length,
    counterparty: allObligations.filter((o) => o.owner === 'counterparty').length,
    both: allObligations.filter((o) => o.owner === 'both').length,
  };

  // Overdue count (not completed and past due date)
  const overdueObligations = allObligations.filter(
    (o) => !['completed', 'cancelled', 'waived'].includes(o.status) && o.dueDate < now
  );
  const overdueCount = overdueObligations.length;

  // At risk (due within 7 days)
  const atRiskObligations = allObligations.filter(
    (o) =>
      !['completed', 'cancelled', 'waived'].includes(o.status) &&
      o.dueDate >= now &&
      o.dueDate <= sevenDaysFromNow
  );
  const atRiskCount = atRiskObligations.length;

  // Due soon (7 days)
  const dueSoon = atRiskCount;

  // Completed this month
  const completedThisMonth = allObligations.filter(
    (o) => o.status === 'completed' && o.completedAt && o.completedAt >= monthStart
  ).length;

  // Compliance rate (completed on time / total completed)
  const completedObligations = allObligations.filter((o) => o.status === 'completed');
  const completedOnTime = completedObligations.filter(
    (o) => o.completedAt && o.completedAt <= o.dueDate
  ).length;
  const complianceRate =
    completedObligations.length > 0
      ? Math.round((completedOnTime / completedObligations.length) * 100)
      : 100;

  // Average completion time (days from due date - negative means early)
  let avgCompletionTime = 0;
  if (completedObligations.length > 0) {
    const totalDays = completedObligations.reduce((sum, o) => {
      if (o.completedAt) {
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
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = allObligations
    .filter(
      (o) =>
        !['completed', 'cancelled', 'waived'].includes(o.status) &&
        o.dueDate >= now &&
        o.dueDate <= thirtyDaysFromNow
    )
    .map((o) => ({
      obligationId: o.id,
      title: o.title,
      dueDate: o.dueDate.toISOString(),
      daysRemaining: Math.ceil((o.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      contractId: o.contractId,
      contractName: o.contractTitle,
      vendorName: o.vendorName,
      priority: o.priority,
      type: o.type,
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 10);

  // Critical items (overdue critical/high priority)
  const criticalItems = overdueObligations
    .filter((o) => ['critical', 'high'].includes(o.priority))
    .map((o) => ({
      obligationId: o.id,
      title: o.title,
      dueDate: o.dueDate.toISOString(),
      daysOverdue: Math.ceil((now.getTime() - o.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      contractId: o.contractId,
      contractName: o.contractTitle,
      priority: o.priority,
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Trend data (last 6 months)
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
      created: allObligations.filter(
        (o) => {
          if (!o.createdAt) return false;
          const date = new Date(o.createdAt);
          return date >= monthDate && date <= monthEnd;
        }
      ).length,
      completed: allObligations.filter(
        (o) => o.completedAt && o.completedAt >= monthDate && o.completedAt <= monthEnd
      ).length,
      overdue: allObligations.filter(
        (o) =>
          o.dueDate >= monthDate &&
          o.dueDate <= monthEnd &&
          !['completed', 'cancelled', 'waived'].includes(o.status)
      ).length,
    });
  }

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
    upcomingDeadlines,
    criticalItems,
    trends,
    generatedAt: now.toISOString(),
  });
});
