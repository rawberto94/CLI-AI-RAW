import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockRateCardBaselineFindMany,
  mockRateCardBaselineCount,
  mockRateCardBaselineCreate,
  mockRateCardBaselineFindFirst,
  mockRateCardBaselineUpdate,
  mockProcurementCategoryFindFirst,
  mockRateCardEntryFindFirst,
  mockBulkCompareAgainstBaselines,
  mockCompareAgainstBaselines,
} = vi.hoisted(() => ({
  mockRateCardBaselineFindMany: vi.fn(),
  mockRateCardBaselineCount: vi.fn(),
  mockRateCardBaselineCreate: vi.fn(),
  mockRateCardBaselineFindFirst: vi.fn(),
  mockRateCardBaselineUpdate: vi.fn(),
  mockProcurementCategoryFindFirst: vi.fn(),
  mockRateCardEntryFindFirst: vi.fn(),
  mockBulkCompareAgainstBaselines: vi.fn(),
  mockCompareAgainstBaselines: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateCardBaseline: {
      findMany: mockRateCardBaselineFindMany,
      count: mockRateCardBaselineCount,
      create: mockRateCardBaselineCreate,
      findFirst: mockRateCardBaselineFindFirst,
      update: mockRateCardBaselineUpdate,
      findUnique: vi.fn(),
    },
    procurementCategory: {
      findFirst: mockProcurementCategoryFindFirst,
    },
    rateCardEntry: {
      findFirst: mockRateCardEntryFindFirst,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  baselineManagementService: class {
    bulkCompareAgainstBaselines = mockBulkCompareAgainstBaselines;
    compareAgainstBaselines = mockCompareAgainstBaselines;
  },
}));

import { GET as getBaselines, POST as postBaseline, PUT as putBaseline } from '../route';
import { POST as postBaselineCompare } from '../compare/route';
import { GET as getBaselineComparison } from '../../[id]/baseline-comparison/route';

function createRequest(url: string, method: 'GET' | 'POST' | 'PUT', body?: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: {
      'x-user-id': 'user-123',
      'x-tenant-id': 'tenant-1',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('rate-card baseline tenant context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists baselines scoped by ctx.tenantId', async () => {
    mockRateCardBaselineFindMany.mockResolvedValue([{ id: 'baseline-1' }]);
    mockRateCardBaselineCount.mockResolvedValue(1);

    const response = await getBaselines(createRequest('/api/rate-cards/baselines', 'GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRateCardBaselineFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1' },
    }));
  });

  it('creates baselines using ctx.userId and ctx.tenantId', async () => {
    mockProcurementCategoryFindFirst.mockResolvedValue({ id: 'category-1' });
    mockRateCardBaselineCreate.mockResolvedValue({ id: 'baseline-1' });

    const response = await postBaseline(
      createRequest('/api/rate-cards/baselines', 'POST', {
        baselineName: 'US Senior Engineer',
        baselineType: 'MARKET',
        role: 'Engineer',
        dailyRateUSD: 1200,
        categoryL1: 'Technology',
        categoryL2: 'Engineering',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockRateCardBaselineCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        metadata: expect.objectContaining({ createdBy: 'user-123' }),
      }),
    }));
  });

  it('rejects PUT updates for baselines outside the tenant', async () => {
    mockRateCardBaselineFindFirst.mockResolvedValue(null);

    const response = await putBaseline(
      createRequest('/api/rate-cards/baselines', 'PUT', {
        id: 'baseline-1',
        baselineName: 'Updated Baseline',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockRateCardBaselineUpdate).not.toHaveBeenCalled();
    expect(mockRateCardBaselineFindFirst).toHaveBeenCalledWith({
      where: { id: 'baseline-1', tenantId: 'tenant-1' },
    });
  });

  it('bulk compares baselines using ctx.tenantId directly', async () => {
    mockBulkCompareAgainstBaselines.mockResolvedValue({ compared: 12 });

    const response = await postBaselineCompare(
      createRequest('/api/rate-cards/baselines/compare', 'POST', {
        minVariancePercentage: 10,
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockBulkCompareAgainstBaselines).toHaveBeenCalledWith('tenant-1', {
      minVariancePercentage: 10,
      baselineTypes: undefined,
      categoryL1: undefined,
      categoryL2: undefined,
    });
  });

  it('returns 404 for baseline comparison when the rate card is outside the tenant', async () => {
    mockRateCardEntryFindFirst.mockResolvedValue(null);

    const response = await getBaselineComparison(
      createRequest('/api/rate-cards/rc-1/baseline-comparison', 'GET'),
      { params: Promise.resolve({ id: 'rc-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockCompareAgainstBaselines).not.toHaveBeenCalled();
  });

  it('compares a tenant-owned rate card against baselines', async () => {
    mockRateCardEntryFindFirst.mockResolvedValue({ id: 'rc-1' });
    mockCompareAgainstBaselines.mockResolvedValue([{ baselineId: 'baseline-1' }]);

    const response = await getBaselineComparison(
      createRequest('/api/rate-cards/rc-1/baseline-comparison', 'GET'),
      { params: Promise.resolve({ id: 'rc-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRateCardEntryFindFirst).toHaveBeenCalledWith({
      where: { id: 'rc-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(mockCompareAgainstBaselines).toHaveBeenCalledWith('rc-1');
  });
});