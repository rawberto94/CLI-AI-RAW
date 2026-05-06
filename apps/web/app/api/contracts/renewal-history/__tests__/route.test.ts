import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindMany,
  mockContractFindFirst,
  mockContractUpdate,
  mockExecuteRaw,
  mockQueryRaw,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
      findFirst: mockContractFindFirst,
      update: mockContractUpdate,
    },
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mockLoggerError,
  },
}));

import { GET, POST } from '../route';

function authRequest(url = 'http://localhost:3000/api/contracts/renewal-history', init?: RequestInit) {
  const extraHeaders = new Headers(init?.headers || {});
  return new NextRequest(url, {
    ...init,
    headers: {
      'x-tenant-id': 'tenant-1',
      'x-user-id': 'user-1',
      ...Object.fromEntries(extraHeaders.entries()),
    },
  } as RequestInit);
}

describe('/api/contracts/renewal-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindMany.mockResolvedValue([]);
    mockContractFindFirst.mockResolvedValue(null);
    mockContractUpdate.mockResolvedValue({});
    mockExecuteRaw.mockResolvedValue(undefined);
    mockQueryRaw.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/contracts/renewal-history'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('scopes renewal history lookups to ctx.tenantId', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'renewal-1',
          contract_id: 'contract-1',
          renewal_number: 1,
          renewal_type: 'STANDARD',
          previous_start_date: new Date('2025-01-01T00:00:00.000Z'),
          previous_end_date: new Date('2025-12-31T00:00:00.000Z'),
          previous_value: 1000,
          previous_terms: {},
          new_start_date: new Date('2026-01-01T00:00:00.000Z'),
          new_end_date: new Date('2026-12-31T00:00:00.000Z'),
          new_value: 1200,
          new_terms: {},
          value_change: 200,
          value_change_percent: 20,
          term_extension: 365,
          negotiation_days: 5,
          negotiation_rounds: 2,
          key_changes: [],
          initiated_by: 'user-1',
          initiated_at: new Date('2025-12-01T00:00:00.000Z'),
          approved_by: 'user-2',
          approved_at: new Date('2025-12-05T00:00:00.000Z'),
          completed_by: 'user-1',
          completed_at: new Date('2025-12-10T00:00:00.000Z'),
          status: 'COMPLETED',
          notes: 'done',
          created_at: new Date('2025-12-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          total: BigInt(1),
          standard: BigInt(1),
          renegotiated: BigInt(0),
          extended: BigInt(0),
          auto_renewed: BigInt(0),
          total_value_change: 200,
          avg_negotiation_days: 5,
          avg_value_change_percent: 20,
        },
      ]);
    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-1',
        contractTitle: 'Master Agreement',
        originalName: 'master.pdf',
        supplierName: 'Vendor',
      },
    ]);

    const response = await GET(authRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        id: { in: ['contract-1'] },
      }),
    }));
    expect(JSON.stringify(mockQueryRaw.mock.calls[0])).toContain('tenant-1');
    expect(JSON.stringify(mockQueryRaw.mock.calls[1])).toContain('tenant-1');
  });

  it('records renewals with ctx tenant and ctx user defaults', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2025-12-31T00:00:00.000Z'),
      expirationDate: new Date('2025-12-31T00:00:00.000Z'),
      totalValue: 1000,
    });
    mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

    const response = await POST(authRequest('http://localhost:3000/api/contracts/renewal-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: 'contract-1',
        renewalData: {
          renewalType: 'STANDARD',
          newEndDate: '2026-12-31T00:00:00.000Z',
        },
      }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(JSON.stringify(mockExecuteRaw.mock.calls[0])).toContain('tenant-1');
    expect(JSON.stringify(mockExecuteRaw.mock.calls[0])).toContain('user-1');
  });
});