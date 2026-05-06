import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindMany } = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
    },
  },
}));

import { POST } from '../route';

function createRequest(withAuth = true, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/compare', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/compare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false, {
      contractId1: 'contract-1',
      contractId2: 'contract-2',
    }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('requires all requested contracts to belong to the tenant', async () => {
    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-1',
        supplierName: 'Acme',
        status: 'ACTIVE',
      },
    ]);

    const response = await POST(createRequest(true, {
      contractId1: 'contract-1',
      contractId2: 'contract-2',
    }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { in: ['contract-1', 'contract-2'] },
        tenantId: 'tenant-1',
      },
    }));
  });

  it('preserves the requested contract order for enhanced comparisons', async () => {
    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-2',
        contractTitle: 'Second Contract',
        supplierName: 'Supplier B',
        status: 'ACTIVE',
        totalValue: 200000,
        annualValue: 0,
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        expirationDate: new Date('2026-12-31T00:00:00.000Z'),
        categoryL1: 'Services',
        categoryL2: null,
        paymentTerms: 'Net 45',
        paymentFrequency: 'Monthly',
        autoRenewalEnabled: false,
        noticePeriodDays: 60,
        currency: 'USD',
        contractType: 'MSA',
      },
      {
        id: 'contract-1',
        contractTitle: 'First Contract',
        supplierName: 'Supplier A',
        status: 'ACTIVE',
        totalValue: 100000,
        annualValue: 0,
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        expirationDate: new Date('2026-06-01T00:00:00.000Z'),
        categoryL1: 'Services',
        categoryL2: null,
        paymentTerms: 'Net 30',
        paymentFrequency: 'Monthly',
        autoRenewalEnabled: true,
        noticePeriodDays: 30,
        currency: 'USD',
        contractType: 'MSA',
      },
    ]);

    const response = await POST(createRequest(true, {
      contractId1: 'contract-1',
      contractId2: 'contract-2',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.entity1.id).toBe('contract-1');
    expect(data.data.entity2.id).toBe('contract-2');
  });
});