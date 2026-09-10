/**
 * Dashboard Metrics API
 * Aggregate metrics for dashboard overview
 * 
 * SECURITY: All queries are tenant-scoped
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';
import { getCached, setCached } from '@/lib/cache';
import { expirationOrEndDateFilter, portfolioWhere } from '@/lib/contracts/server/portfolio';
import { clampTrendPercent } from '@/lib/utils/percent';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;

  const cacheKey = `dashboard:metrics:${tenantId}:v2`;
  const cached = await getCached(cacheKey);
  if (cached) return createSuccessResponse(ctx, cached);

  if (!tenantId) {
    return createErrorResponse(ctx, 'TENANT_REQUIRED', 'Tenant ID required', 400);
  }

  const portfolio = portfolioWhere(tenantId);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalContracts,
    activeContracts,
    processingContracts,
    pendingContracts,
    completedToday,
    byCategory,
    byStatus,
    valueAgg,
    expiringContracts,
    atRiskContracts,
    recentContracts,
    contractsLastMonth,
    contractsThisMonth,
    valueLastMonthAgg,
    valueThisMonthAgg,
  ] = await Promise.all([
    prisma.contract.count({ where: portfolio }),
    prisma.contract.count({ where: { ...portfolio, status: 'ACTIVE' } }),
    prisma.contract.count({ where: { tenantId, isDeleted: false, status: 'PROCESSING' } }),
    prisma.contract.count({ where: { tenantId, isDeleted: false, status: 'PENDING' } }),
    prisma.contract.count({
      where: {
        tenantId,
        isDeleted: false,
        status: 'COMPLETED',
        updatedAt: { gte: todayStart },
      },
    }),
    prisma.contract.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { ...portfolio, category: { not: null } },
    }),
    prisma.contract.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { tenantId, isDeleted: false },
    }),
    prisma.contract.aggregate({
      where: { ...portfolio, totalValue: { not: null } },
      _sum: { totalValue: true },
    }),
    prisma.contract.count({
      where: {
        ...portfolio,
        ...expirationOrEndDateFilter({ gte: now, lte: thirtyDaysFromNow }),
      },
    }),
    prisma.contract.count({
      where: {
        ...portfolio,
        OR: [
          expirationOrEndDateFilter({ gte: thirtyDaysAgo, lt: now }),
          expirationOrEndDateFilter({ gte: now, lte: sevenDaysFromNow }),
        ],
      },
    }),
    prisma.contract.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      where: { tenantId, isDeleted: false },
      select: {
        id: true,
        fileName: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.contract.count({
      where: { ...portfolio, createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
    }),
    prisma.contract.count({
      where: { ...portfolio, createdAt: { gte: thisMonthStart } },
    }),
    prisma.contract.aggregate({
      where: {
        ...portfolio,
        createdAt: { gte: lastMonthStart, lt: thisMonthStart },
        totalValue: { not: null },
      },
      _sum: { totalValue: true },
    }),
    prisma.contract.aggregate({
      where: {
        ...portfolio,
        createdAt: { gte: thisMonthStart },
        totalValue: { not: null },
      },
      _sum: { totalValue: true },
    }),
  ]);

  const recentActivity = recentContracts.map(c => ({
    id: c.id,
    action: c.status === 'COMPLETED' ? 'Processed' :
            c.status === 'PROCESSING' ? 'Processing' : 'Created',
    contract: c.fileName,
    time: c.updatedAt,
  }));

  const totalValue = Number(valueAgg._sum.totalValue || 0);
  const rawContractsChange = contractsLastMonth > 0
    ? ((contractsThisMonth - contractsLastMonth) / contractsLastMonth) * 100
    : contractsThisMonth > 0 ? 100 : 0;
  const contractsChange = clampTrendPercent(rawContractsChange, contractsLastMonth);

  const lastMonthValue = Number(valueLastMonthAgg._sum.totalValue || 0);
  const thisMonthValue = Number(valueThisMonthAgg._sum.totalValue || 0);
  const rawValueChange = lastMonthValue > 0
    ? ((thisMonthValue - lastMonthValue) / lastMonthValue) * 100
    : thisMonthValue > 0 ? 100 : 0;
  const valueChange = clampTrendPercent(rawValueChange, contractsLastMonth);

  const riskChange = 0;

  const data = {
    totalContracts,
    activeContracts,
    expiringContracts,
    atRiskContracts,
    totalValue,
    processingQueue: processingContracts + pendingContracts,
    completedToday,
    avgProcessingTime: 0, // 0 indicates no processing time data available
    trends: {
      contracts: { value: totalContracts, change: contractsChange },
      value: { value: totalValue, change: valueChange },
      risk: { value: atRiskContracts, change: riskChange },
    },
    byType: byCategory.map(c => ({
      type: c.category || 'Other',
      count: c._count.id,
    })),
    byStatus: byStatus.map(s => ({
      status: s.status.charAt(0).toUpperCase() + s.status.slice(1),
      count: s._count.id,
    })),
    recentActivity,
  };
  await setCached(cacheKey, data, { ttl: 60 });
  return createSuccessResponse(ctx, data);
});
