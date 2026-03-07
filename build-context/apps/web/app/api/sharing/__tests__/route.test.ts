import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    documentShare: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: vi.fn(),
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'mock-uuid-1234'),
    randomBytes: vi.fn(() => ({
      toString: () => 'mock-access-token',
    })),
  },
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/sharing',
  body?: Record<string, unknown>
): NextRequest {
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url), options);
}

describe('GET /api/sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when documentId is missing', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Document ID');
  });

  it('should return shares for a document', async () => {
    const mockShares = [
      {
        id: 'share1',
        documentId: 'doc1',
        documentType: 'contract',
        sharedWith: 'user@example.com',
        sharedBy: 'current-user',
        permission: 'VIEW',
        isActive: true,
        createdAt: new Date(),
      },
    ];

    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.documentShare.findMany).mockResolvedValue(mockShares);

    const request = createRequest('GET', 'http://localhost:3000/api/sharing?documentId=doc1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.shares).toBeDefined();
  });

  it('should filter by document type', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.documentShare.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/sharing?documentId=doc1&documentType=rate_card');
    await GET(request);

    expect(prisma.documentShare.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ documentType: 'rate_card' }),
      })
    );
  });

  it('should fallback to mock data on database error', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.documentShare.findMany).mockRejectedValue(new Error('Database error'));

    const request = createRequest('GET', 'http://localhost:3000/api/sharing?documentId=doc1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.shares).toBeDefined();
  });
});

describe('POST /api/sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when required fields are missing', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('POST', 'http://localhost:3000/api/sharing', {});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should create a new share successfully', async () => {
    const mockShare = {
      id: 'share1',
      documentId: 'doc1',
      documentType: 'contract',
      sharedWith: 'user@example.com',
      sharedBy: 'current-user',
      permission: 'VIEW',
      isActive: true,
      createdAt: new Date(),
    };

    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.documentShare.create).mockResolvedValue(mockShare);

    const request = createRequest('POST', 'http://localhost:3000/api/sharing', {
      documentId: 'doc1',
      documentType: 'contract',
      sharedWith: 'user@example.com',
      permission: 'VIEW',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.share).toBeDefined();
  });

  it('should support different permission levels', async () => {
    const mockShare = {
      id: 'share1',
      documentId: 'doc1',
      permission: 'EDIT',
      isActive: true,
      createdAt: new Date(),
    };

    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.documentShare.create).mockResolvedValue(mockShare);

    const request = createRequest('POST', 'http://localhost:3000/api/sharing', {
      documentId: 'doc1',
      documentType: 'contract',
      sharedWith: 'editor@example.com',
      permission: 'EDIT',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe('DELETE /api/sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when share ID is missing', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('DELETE', 'http://localhost:3000/api/sharing');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should delete share successfully', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.documentShare.findFirst).mockResolvedValue({
      id: 'share1',
      tenantId: 'tenant1',
    });
    vi.mocked(prisma.documentShare.delete).mockResolvedValue({ id: 'share1' });

    const request = createRequest('DELETE', 'http://localhost:3000/api/sharing?id=share1');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 404 when share not found', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.documentShare.findFirst).mockResolvedValue(null);

    const request = createRequest('DELETE', 'http://localhost:3000/api/sharing?id=nonexistent');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });
});
