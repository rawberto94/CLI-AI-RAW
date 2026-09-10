import { ContractStatus } from '@prisma/client';

import { createSuccessResponse, type ContractApiContext } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { PORTFOLIO_STATUSES } from '@/lib/contracts/server/portfolio';

const SUMMARY_STATUS_BUCKETS = {
  activeContracts: [ContractStatus.ACTIVE, ContractStatus.COMPLETED],
  draftContracts: [ContractStatus.DRAFT, ContractStatus.PENDING, ContractStatus.UPLOADED],
  completedContracts: [ContractStatus.COMPLETED],
  archivedContracts: [
    ContractStatus.ARCHIVED,
    ContractStatus.CANCELLED,
    ContractStatus.EXPIRED,
  ],
} as const;

function buildStatusBreakdown(
  statusCounts: Array<{ status: ContractStatus; _count: { status: number } }>,
) {
  const statusMap: Record<string, number> = {};

  for (const item of statusCounts) {
    statusMap[item.status] = item._count.status;
  }

  const sumBucket = (statuses: readonly ContractStatus[]) =>
    statuses.reduce((total, status) => total + (statusMap[status] || 0), 0);

  return {
    statusMap,
    activeContracts: sumBucket(SUMMARY_STATUS_BUCKETS.activeContracts),
    draftContracts: sumBucket(SUMMARY_STATUS_BUCKETS.draftContracts),
    completedContracts: sumBucket(SUMMARY_STATUS_BUCKETS.completedContracts),
    archivedContracts: sumBucket(SUMMARY_STATUS_BUCKETS.archivedContracts),
  };
}

export async function getContractsSummary(context: ContractApiContext) {
  const tenantId = context.tenantId;

  const baseWhere = {
    tenantId,
    isDeleted: false,
  };

  const portfolioWhere = {
    ...baseWhere,
    status: { in: PORTFOLIO_STATUSES },
  };

  const [
    totalContracts,
    statusCounts,
    expiringContracts,
    recentContracts,
    valueResult,
  ] = await Promise.all([
    prisma.contract.count({
      where: portfolioWhere,
    }),
    prisma.contract.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { status: true },
    }),
    prisma.contract.count({
      where: {
        ...portfolioWhere,
        expirationDate: {
          gte: new Date(),
          lte: getDateOffsetFromNow(30),
        },
      },
    }),
    prisma.contract.count({
      where: {
        ...portfolioWhere,
        createdAt: {
          gte: getDateOffsetFromNow(-7),
        },
      },
    }),
    prisma.contract.aggregate({
      where: {
        ...portfolioWhere,
        totalValue: { not: null },
      },
      _sum: { totalValue: true },
    }),
  ]);

  const breakdown = buildStatusBreakdown(statusCounts);

  return createSuccessResponse(context, {
    totalContracts,
    activeContracts: breakdown.activeContracts,
    draftContracts: breakdown.draftContracts,
    completedContracts: breakdown.completedContracts,
    archivedContracts: breakdown.archivedContracts,
    expiringContracts,
    recentContracts,
    totalValue: valueResult._sum.totalValue || 0,
    statusBreakdown: breakdown.statusMap,
  });
}

function getDateOffsetFromNow(days: number) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}