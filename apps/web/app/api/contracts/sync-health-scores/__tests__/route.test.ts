import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindMany, mockExecuteRaw, mockQueryRaw } = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
    },
    $executeRaw: mockExecuteRaw,
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { GET, POST } from '../route';

function authRequest(body?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST') {
  return new NextRequest('http://localhost:3000/api/contracts/sync-health-scores', {
    method,
    headers: {
      'x-tenant-id': 'tenant-auth',
      'x-user-id': 'user-auth',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/sync-health-scores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindMany.mockResolvedValue([]);
    mockExecuteRaw.mockResolvedValue(undefined);
    mockQueryRaw.mockResolvedValue([]);
  });

  it('limits recalculation to the requested contract ids when provided', async () => {
    const response = await POST(authRequest({ contractIds: ['contract-1', 'contract-2', 'contract-1'] }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-auth',
        id: { in: ['contract-1', 'contract-2'] },
      }),
    }));
  });

  it('recalculates the full tenant portfolio when no contract ids are provided', async () => {
    await POST(authRequest());

    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({
        id: expect.anything(),
      }),
    }));
  });

  it('returns tenant-scoped sync summary stats on GET', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        total: BigInt(3),
        avg_overall: 72,
        avg_risk: 68,
        avg_compliance: 80,
        critical_count: BigInt(1),
        high_count: BigInt(1),
        medium_count: BigInt(0),
        healthy_count: BigInt(1),
      },
    ]);

    const response = await GET(authRequest(undefined, 'GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.summary).toEqual({
      total: 3,
      averageScore: 72,
      averageRiskScore: 68,
      averageComplianceScore: 80,
    });
    expect(JSON.stringify(mockQueryRaw.mock.calls[0])).toContain('tenant-auth');
  });
});