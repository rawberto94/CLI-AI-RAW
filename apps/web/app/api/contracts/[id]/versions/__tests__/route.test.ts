import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetDb,
  mockContractFindFirst,
  mockContractUpdate,
  mockContractVersionFindMany,
  mockContractVersionFindFirst,
  mockContractVersionCreate,
  mockContractVersionUpdateMany,
  mockContractVersionUpdate,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockContractVersionFindMany: vi.fn(),
  mockContractVersionFindFirst: vi.fn(),
  mockContractVersionCreate: vi.fn(),
  mockContractVersionUpdateMany: vi.fn(),
  mockContractVersionUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: mockGetDb,
}));

vi.mock('@/lib/storage-service', () => ({
  initializeStorage: vi.fn(),
}));

import { GET, POST, PUT } from '../route';

function createRequest(
  method: 'GET' | 'POST' | 'PUT',
  withAuth = true,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/versions', {
    method,
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

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('/api/contracts/[id]/versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      contract: {
        findFirst: mockContractFindFirst,
        update: mockContractUpdate,
      },
      contractVersion: {
        findMany: mockContractVersionFindMany,
        findFirst: mockContractVersionFindFirst,
        create: mockContractVersionCreate,
        updateMany: mockContractVersionUpdateMany,
        update: mockContractVersionUpdate,
      },
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest('GET', false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 on GET when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractVersionFindMany).not.toHaveBeenCalled();
  });

  it('returns versions for a tenant-owned contract', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockContractVersionFindMany.mockResolvedValue([
      {
        id: 'ver-1',
        versionNumber: 1,
        uploadedBy: 'user-1',
        uploadedAt: new Date('2026-04-28T12:00:00.000Z'),
        isActive: true,
        summary: 'Initial version',
        changes: [],
        fileUrl: '/api/files/versions/ver-1.pdf',
        uploadedByUser: null,
      },
    ]);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.versions).toHaveLength(1);
  });

  it('creates a metadata-only version for a tenant-owned contract', async () => {
    const uploadedAt = new Date('2026-04-28T12:00:00.000Z');
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockContractVersionFindFirst.mockResolvedValue({
      id: 'ver-1',
      versionNumber: 1,
      isActive: true,
    });
    mockContractVersionCreate.mockResolvedValue({
      id: 'ver-2',
      versionNumber: 2,
      summary: 'Metadata update',
      changes: { field: 'value' },
      fileUrl: null,
      uploadedBy: 'user-1',
      uploadedAt,
      isActive: true,
    });
    mockContractUpdate.mockResolvedValue({ id: 'contract-1' });

    const response = await POST(createRequest('POST', true, {
      summary: 'Metadata update',
      changes: { field: 'value' },
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractVersionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ver-1' },
      data: expect.objectContaining({ isActive: false }),
    }));
    expect(mockContractVersionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        versionNumber: 2,
        uploadedBy: 'user-1',
        summary: 'Metadata update',
      }),
    }));
  });

  it('returns 404 on PUT when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await PUT(createRequest('PUT', true, { versionNumber: 2 }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockContractVersionFindFirst).not.toHaveBeenCalled();
  });

  it('activates a version for a tenant-owned contract', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockContractVersionFindFirst.mockResolvedValue({
      id: 'ver-2',
      versionNumber: 2,
      summary: 'Revised version',
    });
    mockContractVersionUpdateMany.mockResolvedValue({ count: 2 });
    mockContractVersionUpdate.mockResolvedValue({ id: 'ver-2' });

    const response = await PUT(createRequest('PUT', true, { versionNumber: 2 }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractVersionUpdateMany).toHaveBeenCalled();
    expect(mockContractVersionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ver-2' },
      data: { isActive: true },
    }));
  });
});