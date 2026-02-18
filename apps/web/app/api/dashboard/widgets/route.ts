import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

/**
 * Dashboard Widgets API
 * GET /api/dashboard/widgets - Get aggregated stats for all dashboard widgets
 * This single endpoint reduces the number of API calls needed for the dashboard
 */

export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
  
  const [approvals, renewals, intelligence, governance] = await Promise.all([
    getApprovalsStats(tenantId),
    getRenewalsStats(tenantId),
    getIntelligenceStats(tenantId),
    getGovernanceStats(tenantId),
  ]);

  return createSuccessResponse(ctx, {
    approvals,
    renewals,
    intelligence,
    governance,
    lastUpdated: new Date().toISOString(),
  });
});

async function getApprovalsStats(tenantId: string) {
  const now = new Date();
  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      isDeleted: false,
      status: 'PENDING',
    },
    select: {
      id: true,
      contractTitle: true,
      totalValue: true,
      status: true,
      expirationDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const overdue = contracts.filter(c => c.expirationDate && c.expirationDate < now).length;

  return {
    pending: contracts.length,
    urgent: contracts.filter(c => c.expirationDate && c.expirationDate < new Date(Date.now() + 7 * 86400000)).length,
    overdue,
    avgProcessingTime: null, // Requires processing-time tracking
    recentItems: contracts.map(c => ({
      id: c.id,
      title: c.contractTitle || 'Untitled Contract',
      priority: c.expirationDate && c.expirationDate < new Date(Date.now() + 3 * 86400000) ? 'critical' : 'high',
      dueDate: c.expirationDate?.toISOString() || null,
      type: 'contract',
      value: c.totalValue ? Number(c.totalValue) : null,
    })),
  };
}

async function getRenewalsStats(tenantId: string) {
  const now = new Date();
  const ninetyDaysOut = new Date(Date.now() + 90 * 86400000);

  const expiringContracts = await prisma.contract.findMany({
    where: {
      tenantId,
      isDeleted: false,
      expirationDate: { gte: now, lte: ninetyDaysOut },
      status: { notIn: ['EXPIRED', 'CANCELLED'] },
    },
    select: {
      id: true,
      contractTitle: true,
      expirationDate: true,
      totalValue: true,
      autoRenewalEnabled: true,
      status: true,
    },
    orderBy: { expirationDate: 'asc' },
  });

  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    total: expiringContracts.length,
    urgentCount: expiringContracts.filter(c => c.expirationDate && c.expirationDate < new Date(Date.now() + 7 * 86400000)).length,
    expiringThisMonth: expiringContracts.filter(c => c.expirationDate && c.expirationDate <= thisMonthEnd).length,
    autoRenewalCount: expiringContracts.filter(c => c.autoRenewalEnabled).length,
    totalValue: expiringContracts.reduce((sum, c) => sum + (c.totalValue ? Number(c.totalValue) : 0), 0),
    recentItems: expiringContracts.slice(0, 5).map(c => ({
      id: c.id,
      contractName: c.contractTitle || 'Untitled Contract',
      daysUntil: c.expirationDate ? Math.ceil((c.expirationDate.getTime() - now.getTime()) / 86400000) : null,
      value: c.totalValue ? Number(c.totalValue) : null,
      autoRenewal: c.autoRenewalEnabled ?? false,
      status: c.expirationDate && c.expirationDate < new Date(Date.now() + 7 * 86400000) ? 'urgent' : 'pending-review',
    })),
  };
}

async function getIntelligenceStats(tenantId: string) {
  const [totalContracts, metadata] = await Promise.all([
    prisma.contract.count({ where: { tenantId, isDeleted: false } }),
    prisma.contractMetadata.findMany({
      where: { tenantId },
      select: { riskScore: true },
    }),
  ]);

  const withScore = metadata.filter(m => m.riskScore !== null && m.riskScore !== undefined);
  const avgScore = withScore.length > 0
    ? Math.round(withScore.reduce((sum, m) => sum + Number(m.riskScore), 0) / withScore.length)
    : null;

  return {
    avgScore,
    healthy: withScore.filter(m => Number(m.riskScore) >= 70).length,
    atRisk: withScore.filter(m => Number(m.riskScore) >= 40 && Number(m.riskScore) < 70).length,
    critical: withScore.filter(m => Number(m.riskScore) < 40).length,
    totalContracts,
    scoredContracts: withScore.length,
    recentInsights: [], // Populated from insights table when available
  };
}

async function getGovernanceStats(tenantId: string) {
  const [totalContracts, pendingReviewCount] = await Promise.all([
    prisma.contract.count({ where: { tenantId, isDeleted: false } }),
    prisma.contract.count({ where: { tenantId, isDeleted: false, status: 'PENDING' } }),
  ]);

  return {
    complianceScore: null, // Needs compliance tracking feature
    activePolicies: null,  // Needs policy management feature
    openViolations: null,  // Needs violation tracking
    pendingReviews: pendingReviewCount,
    totalContracts,
    recentFlags: [], // Populated from governance flags table when available
  };
}
