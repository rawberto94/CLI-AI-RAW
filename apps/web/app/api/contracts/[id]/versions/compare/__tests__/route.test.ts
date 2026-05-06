import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetDb,
  mockContractFindFirst,
  mockContractVersionFindFirst,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockContractVersionFindFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: mockGetDb,
}));

import { GET } from '../route';

function createRequest(withAuth = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/versions/compare?v1=1&v2=2', {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('GET /api/contracts/[id]/versions/compare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      contract: {
        findFirst: mockContractFindFirst,
      },
      contractVersion: {
        findFirst: mockContractVersionFindFirst,
      },
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractVersionFindFirst).not.toHaveBeenCalled();
  });

  it('returns version differences for a tenant-owned contract', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockContractVersionFindFirst
      .mockResolvedValueOnce({ id: 'ver-1', versionNumber: 1, changes: [] })
      .mockResolvedValueOnce({
        id: 'ver-2',
        versionNumber: 2,
        changes: [
          {
            field: 'effectiveDate',
            oldValue: '2026-01-01',
            newValue: '2026-02-01',
            changeType: 'modified',
          },
        ],
      });

    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.summary.totalChanges).toBe(1);
    expect(data.data.differences).toHaveLength(1);
  });
});