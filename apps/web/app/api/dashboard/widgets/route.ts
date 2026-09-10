import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { expirationOrEndDateFilter, portfolioWhere } from '@/lib/contracts/server/portfolio';

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
      ...portfolioWhere(tenantId),
      ...expirationOrEndDateFilter({ gte: now, lte: ninetyDaysOut }),
    },
    select: {
      id: true,
      contractTitle: true,
      expirationDate: true,
      endDate: true,
      totalValue: true,
      autoRenewalEnabled: true,
      status: true,
    },
    orderBy: { expirationDate: 'asc' },
  });

  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const sevenDaysOut = new Date(Date.now() + 7 * 86400000);

  return {
    total: expiringContracts.length,
    urgentCount: expiringContracts.filter(c => {
      const expiry = c.expirationDate || c.endDate;
      return expiry != null && expiry < sevenDaysOut;
    }).length,
    expiringThisMonth: expiringContracts.filter(c => {
      const expiry = c.expirationDate || c.endDate;
      return expiry != null && expiry <= thisMonthEnd;
    }).length,
    autoRenewalCount: expiringContracts.filter(c => c.autoRenewalEnabled).length,
    totalValue: expiringContracts.reduce((sum, c) => sum + (c.totalValue ? Number(c.totalValue) : 0), 0),
    recentItems: expiringContracts.slice(0, 5).map(c => {
      const expiry = c.expirationDate || c.endDate;
      return {
        id: c.id,
        contractName: c.contractTitle || 'Untitled Contract',
        daysUntil: expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null,
        value: c.totalValue ? Number(c.totalValue) : null,
        autoRenewal: c.autoRenewalEnabled ?? false,
        status: expiry && expiry < sevenDaysOut ? 'urgent' : 'pending-review',
      };
    }),
  };
}

async function getIntelligenceStats(tenantId: string) {
  const [totalContracts, metadata] = await Promise.all([
    prisma.contract.count({ where: portfolioWhere(tenantId) }),
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
    prisma.contract.count({ where: portfolioWhere(tenantId) }),
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
