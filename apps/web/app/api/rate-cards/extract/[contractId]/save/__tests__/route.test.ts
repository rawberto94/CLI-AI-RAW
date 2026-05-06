import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockRateCardSupplierFindFirst,
  mockRateCardSupplierCreate,
  mockRateCardEntryCreate,
  mockRecalculateBenchmark,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockRateCardSupplierFindFirst: vi.fn(),
  mockRateCardSupplierCreate: vi.fn(),
  mockRateCardEntryCreate: vi.fn(),
  mockRecalculateBenchmark: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    rateCardSupplier: {
      findFirst: mockRateCardSupplierFindFirst,
      create: mockRateCardSupplierCreate,
    },
    rateCardEntry: {
      create: mockRateCardEntryCreate,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  realTimeBenchmarkService: class {
    recalculateBenchmark = mockRecalculateBenchmark;
  },
}));

import { POST } from '../route';

function createRequest(withAuth = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/rate-cards/extract/contract-1/save', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify({
      rates: [
        {
          roleOriginal: 'Program Manager',
          roleStandardized: 'Program Manager',
          seniority: 'SENIOR',
          dailyRate: 1500,
          currency: 'USD',
          confidence: 0.9,
        },
        {
          roleOriginal: 'Business Analyst',
          roleStandardized: 'Business Analyst',
          seniority: 'MID',
          dailyRate: 900,
          currency: 'USD',
          confidence: 0.8,
        },
      ],
      supplierInfo: {
        name: 'Acme Consulting',
        country: 'United States',
        tier: 'TIER_2',
      },
      contractContext: {
        contractType: 'SOW',
      },
    }),
  });
}

const routeContext = {
  params: Promise.resolve({ contractId: 'contract-1' }),
};

describe('POST /api/rate-cards/extract/[contractId]/save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateCardSupplierFindFirst.mockResolvedValue(null);
    mockRateCardSupplierCreate.mockResolvedValue({
      id: 'supplier-1',
      name: 'Acme Consulting',
      tier: 'TIER_2',
      country: 'United States',
      region: 'Americas',
    });
    mockRecalculateBenchmark.mockResolvedValue({ success: true });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await POST(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockRateCardEntryCreate).not.toHaveBeenCalled();
    expect(mockRecalculateBenchmark).not.toHaveBeenCalled();
  });

  it('recalculates benchmarks for each saved extracted rate card', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1', tenantId: 'tenant-1' });
    mockRateCardEntryCreate
      .mockResolvedValueOnce({ id: 'rc-1' })
      .mockResolvedValueOnce({ id: 'rc-2' });

    const response = await POST(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.saved).toBe(2);
    expect(mockRecalculateBenchmark).toHaveBeenCalledTimes(2);
    expect(mockRecalculateBenchmark).toHaveBeenNthCalledWith(1, 'rc-1');
    expect(mockRecalculateBenchmark).toHaveBeenNthCalledWith(2, 'rc-2');
  });
});