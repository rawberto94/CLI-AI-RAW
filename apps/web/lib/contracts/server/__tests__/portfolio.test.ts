import { ContractStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  EXCLUDED_FROM_PORTFOLIO,
  PORTFOLIO_STATUSES,
  PROCESSING_STATUSES,
  expirationOrEndDateFilter,
  portfolioWhere,
  tenantAliveWhere,
} from '../portfolio';

/** Mirrors dashboard /api/dashboard/stats counting over portfolioWhere. */
function dashboardOverviewCounts(statuses: ContractStatus[]) {
  const totalContracts = statuses.filter((status) => PORTFOLIO_STATUSES.includes(status)).length;
  const activeContracts = statuses.filter((status) => status === ContractStatus.ACTIVE).length;
  return { totalContracts, activeContracts };
}

describe('portfolioWhere', () => {
  it('scopes to the tenant, non-deleted rows, and portfolio statuses only', () => {
    expect(portfolioWhere('tenant-1')).toEqual({
      tenantId: 'tenant-1',
      isDeleted: false,
      status: { in: PORTFOLIO_STATUSES },
    });
  });

  it('includes ACTIVE and COMPLETED in the portfolio', () => {
    expect(PORTFOLIO_STATUSES).toEqual([ContractStatus.ACTIVE, ContractStatus.COMPLETED]);
  });

  it('excludes failed, draft, cancelled, and processing statuses from the portfolio', () => {
    const excluded = new Set(EXCLUDED_FROM_PORTFOLIO);
    for (const status of [
      ContractStatus.FAILED,
      ContractStatus.DRAFT,
      ContractStatus.CANCELLED,
      ContractStatus.PROCESSING,
      ...PROCESSING_STATUSES,
    ]) {
      expect(excluded.has(status)).toBe(true);
      expect(PORTFOLIO_STATUSES).not.toContain(status);
    }
  });
});

describe('dashboard overview counts', () => {
  it('excludes failed/draft/cancelled/processing from totalContracts and counts ACTIVE as active', () => {
    const { totalContracts, activeContracts } = dashboardOverviewCounts([
      ContractStatus.ACTIVE,
      ContractStatus.ACTIVE,
      ContractStatus.COMPLETED,
      ContractStatus.FAILED,
      ContractStatus.DRAFT,
      ContractStatus.CANCELLED,
      ContractStatus.PROCESSING,
      ContractStatus.UPLOADED,
      ContractStatus.QUEUED,
      ContractStatus.PENDING,
    ]);

    expect(totalContracts).toBe(3);
    expect(activeContracts).toBe(2);
  });
});

describe('tenantAliveWhere', () => {
  it('keeps non-deleted tenant contracts that are not DELETED or CANCELLED', () => {
    expect(tenantAliveWhere('tenant-1')).toEqual({
      tenantId: 'tenant-1',
      isDeleted: false,
      status: { notIn: [ContractStatus.DELETED, ContractStatus.CANCELLED] },
    });
  });
});

describe('expirationOrEndDateFilter', () => {
  it('matches expirationDate, or endDate when expirationDate is null', () => {
    const range = { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') };
    expect(expirationOrEndDateFilter(range)).toEqual({
      OR: [
        { expirationDate: range },
        { AND: [{ expirationDate: null }, { endDate: range }] },
      ],
    });
  });
});
