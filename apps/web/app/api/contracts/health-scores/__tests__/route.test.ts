import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockQueryRaw,
  mockContractFindMany,
  mockFetch,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    contract: {
      findMany: mockContractFindMany,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { GET, POST } from '../route';

function authRequest(url: string, method: 'GET' | 'POST', body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: {
      'x-user-id': 'user-auth',
      'x-tenant-id': 'tenant-auth',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/health-scores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('filters GET queries by the authenticated tenant', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          total: BigInt(0),
          avg_score: 0,
          avg_risk: 0,
          avg_compliance: 0,
          avg_financial: 0,
          avg_renewal_readiness: 0,
          critical_count: BigInt(0),
          high_count: BigInt(0),
          medium_count: BigInt(0),
          low_count: BigInt(0),
          healthy_count: BigInt(0),
          improving: BigInt(0),
          declining: BigInt(0),
          stable: BigInt(0),
        },
      ]);
    mockContractFindMany.mockResolvedValue([]);

    const response = await GET(authRequest('http://localhost:3000/api/contracts/health-scores', 'GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(JSON.stringify(mockQueryRaw.mock.calls[0])).toContain('tenant-auth');
  });

  it('forwards authenticated headers when triggering recalculation', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { synced: 3 } }), { status: 200 }));

    const response = await POST(
      authRequest('http://localhost:3000/api/contracts/health-scores', 'POST', {
        action: 'recalculate',
        contractIds: ['contract-1'],
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/contracts/sync-health-scores',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-auth',
          'x-user-id': 'user-auth',
        }),
        body: JSON.stringify({ tenantId: 'tenant-auth', contractIds: ['contract-1'] }),
      }),
    );
  });
});