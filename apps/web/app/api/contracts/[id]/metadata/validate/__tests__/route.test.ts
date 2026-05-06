import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockContractMetadataFindUnique,
  mockContractMetadataUpdate,
  mockContractMetadataCreate,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractMetadataFindUnique: vi.fn(),
  mockContractMetadataUpdate: vi.fn(),
  mockContractMetadataCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    contractMetadata: {
      findUnique: mockContractMetadataFindUnique,
      update: mockContractMetadataUpdate,
      create: mockContractMetadataCreate,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { PUT } from '../route';

function createRequest(withAuth = true, body: Record<string, unknown> = { resetAll: true }): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/metadata/validate', {
    method: 'PUT',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: JSON.stringify(body),
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('PUT /api/contracts/[id]/metadata/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const response = await PUT(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await PUT(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractMetadataFindUnique).not.toHaveBeenCalled();
  });

  it('resets validations for a tenant-owned contract', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockContractMetadataFindUnique.mockResolvedValue({
      contractId: 'contract-1',
      customFields: {
        _fieldValidations: {
          effectiveDate: { status: 'validated' },
        },
      },
    });
    mockContractMetadataUpdate.mockResolvedValue(undefined);

    const response = await PUT(createRequest(true, { resetAll: true }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractMetadataUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { contractId: 'contract-1' },
      data: expect.objectContaining({
        updatedBy: 'human-validator',
      }),
    }));
  });
});