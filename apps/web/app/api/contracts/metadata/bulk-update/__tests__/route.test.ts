import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindMany, mockBulkUpdateMetadata } = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockBulkUpdateMetadata: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  metadataEditorService: {
    bulkUpdateMetadata: mockBulkUpdateMetadata,
  },
}));

import { POST } from '../route';

function createRequest(withAuth = true, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/metadata/bulk-update', {
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

describe('/api/contracts/metadata/bulk-update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindMany.mockResolvedValue([{ id: 'contract-1' }, { id: 'contract-2' }]);
    mockBulkUpdateMetadata.mockResolvedValue({ successful: 2, failed: 0 });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false, {
      contractIds: ['contract-1'],
      updates: { tags: ['renewal'] },
    }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('verifies tenant ownership before bulk update', async () => {
    const response = await POST(createRequest(true, {
      contractIds: ['contract-1', 'contract-2'],
      updates: { tags: ['renewal'] },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['contract-1', 'contract-2'] }, tenantId: 'tenant-1' },
    }));
    expect(mockBulkUpdateMetadata).toHaveBeenCalledWith({
      contractIds: ['contract-1', 'contract-2'],
      updates: { tags: ['renewal'], tenantId: 'tenant-1' },
      userId: 'user-1',
    });
    expect(data.data.totalProcessed).toBe(2);
  });
});