import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockContractFindUnique,
  mockContractUpdate,
  mockContractMetadataFindUnique,
  mockCheckContractWritePermission,
  mockApplySideEffects,
  mockRemoveTag,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractFindUnique: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockContractMetadataFindUnique: vi.fn(),
  mockCheckContractWritePermission: vi.fn(),
  mockApplySideEffects: vi.fn(),
  mockRemoveTag: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
      findUnique: mockContractFindUnique,
      update: mockContractUpdate,
    },
    contractMetadata: {
      findUnique: mockContractMetadataFindUnique,
    },
  },
}));

vi.mock('@/lib/security/contract-acl', () => ({
  checkContractWritePermission: mockCheckContractWritePermission,
}));

vi.mock('@/lib/contracts/server/contract-change-side-effects', () => ({
  applyContractChangeSideEffects: mockApplySideEffects,
}));

vi.mock('data-orchestration/services', () => ({
  metadataEditorService: {
    removeTag: mockRemoveTag,
  },
}));

import { DELETE } from '../route';

function createRequest(withAuth = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/metadata/tags/nda', {
    method: 'DELETE',
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
  params: Promise.resolve({ id: 'contract-1', tagName: 'nda' }),
};

describe('DELETE /api/contracts/[id]/metadata/tags/[tagName]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const response = await DELETE(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await DELETE(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockRemoveTag).not.toHaveBeenCalled();
  });

  it('removes the tag for a tenant-owned contract', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockCheckContractWritePermission.mockResolvedValue({ allowed: true });
    mockRemoveTag.mockResolvedValue(undefined);
    mockContractMetadataFindUnique.mockResolvedValue({ tags: ['msa'] });
    mockContractFindUnique.mockResolvedValue({ aiMetadata: { tags: ['msa', 'nda'] } });
    mockContractUpdate.mockResolvedValue({});
    mockApplySideEffects.mockResolvedValue({ ragReindexQueued: false });

    const response = await DELETE(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRemoveTag).toHaveBeenCalledWith('contract-1', 'tenant-1', 'nda', 'user-1');
    expect(mockContractUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        tags: ['msa'],
        aiMetadata: expect.objectContaining({ tags: ['msa'] }),
      }),
    }));
  });

  it('returns 403 when the user lacks edit permission', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockCheckContractWritePermission.mockResolvedValue({ allowed: false, reason: 'forbidden' });

    const response = await DELETE(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(mockRemoveTag).not.toHaveBeenCalled();
  });
});