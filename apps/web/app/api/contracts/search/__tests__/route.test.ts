import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockQueryContracts } = vi.hoisted(() => ({
  mockQueryContracts: vi.fn(),
}));

vi.mock('@/lib/data-orchestration', () => ({
  contractService: {
    queryContracts: mockQueryContracts,
  },
}));

import { GET, POST } from '../route';

function createRequest(
  method: 'GET' | 'POST',
  withAuth = true,
  body?: Record<string, unknown>,
  query = '',
) {
  return new NextRequest(`http://localhost:3000/api/contracts/search${query}`, {
    method,
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryContracts.mockResolvedValue({
      success: true,
      data: {
        contracts: [
          {
            id: 'contract-1',
            fileName: 'acme-msa.pdf',
            contractTitle: 'Acme MSA',
            clientName: 'Acme',
            supplierName: 'Vendor',
            contractType: 'MSA',
            status: 'ACTIVE',
            createdAt: new Date('2026-04-29T00:00:00.000Z'),
          },
        ],
      },
      pagination: { total: 1 },
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest('POST', false, { query: 'acme' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('uses ctx.tenantId for GET search', async () => {
    const response = await GET(createRequest('GET', true, undefined, '?q=acme&limit=10'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockQueryContracts).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      search: 'acme',
      limit: 10,
    }));
    expect(data.data.data.results[0].contractId).toBe('contract-1');
  });

  it('uses ctx.tenantId for POST search', async () => {
    const response = await POST(createRequest('POST', true, { query: 'acme', mode: 'balanced' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockQueryContracts).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      search: 'acme',
    }));
    expect(data.data.data.recommendations.suggestedMode).toBe('balanced');
  });
});