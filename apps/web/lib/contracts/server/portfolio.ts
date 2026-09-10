import type { Prisma } from '@prisma/client';
import { ContractStatus } from '@prisma/client';

/**
 * Single definition of "portfolio" contracts used by dashboard, contracts stats,
 * renewals, and analytics. Failed/cancelled/draft/processing uploads are not
 * part of Total contracts or Total value.
 */
export const PORTFOLIO_STATUSES: ContractStatus[] = [
  ContractStatus.ACTIVE,
  ContractStatus.COMPLETED,
];

export const PROCESSING_STATUSES: ContractStatus[] = [
  ContractStatus.UPLOADED,
  ContractStatus.QUEUED,
  ContractStatus.PROCESSING,
  ContractStatus.PENDING,
];

export const EXCLUDED_FROM_PORTFOLIO: ContractStatus[] = [
  ContractStatus.FAILED,
  ContractStatus.CANCELLED,
  ContractStatus.DELETED,
  ContractStatus.ARCHIVED,
  ContractStatus.DRAFT,
  ContractStatus.EXPIRED,
  ...PROCESSING_STATUSES,
];

export function portfolioWhere(tenantId: string): Prisma.ContractWhereInput {
  return {
    tenantId,
    isDeleted: false,
    status: { in: PORTFOLIO_STATUSES },
  };
}

export function tenantAliveWhere(tenantId: string): Prisma.ContractWhereInput {
  return {
    tenantId,
    isDeleted: false,
    status: { notIn: [ContractStatus.DELETED, ContractStatus.CANCELLED] },
  };
}

/** Date used for expiry / renewal windows. */
export function expirationOrEndDateFilter(range: Prisma.DateTimeFilter): Prisma.ContractWhereInput {
  return {
    OR: [
      { expirationDate: range },
      { AND: [{ expirationDate: null }, { endDate: range }] },
    ],
  };
}
