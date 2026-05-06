import { ContractStatus } from '@prisma/client';

import { createSuccessResponse, type ContractApiContext } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

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
  } as const;

  const [
    totalContracts,
    statusCounts,
    expiringContracts,
    recentContracts,
    valueResult,
  ] = await Promise.all([
    prisma.contract.count({
      where: baseWhere,
    }),
    prisma.contract.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { status: true },
    }),
    prisma.contract.count({
      where: {
        ...baseWhere,
        expirationDate: {
          gte: new Date(),
          lte: getDateOffsetFromNow(30),
        },
      },
    }),
    prisma.contract.count({
      where: {
        ...baseWhere,
        createdAt: {
          gte: getDateOffsetFromNow(-7),
        },
      },
    }),
    prisma.contract.aggregate({
      where: {
        ...baseWhere,
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