import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany, mockGetServerSession } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockGetServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockFindMany,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { POST } from '../route';

function createAuthenticatedRequest(
  url: string,
  body: object
): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function createUnauthenticatedRequest(url: string, body: object): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', tenantId: 'test-tenant', email: 'test@example.com' },
    });
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/search', { query: 'test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns search results', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'c1',
        contractTitle: 'NDA Agreement',
        fileName: 'nda.pdf',
        description: 'Non-disclosure agreement',
        supplierName: 'Acme Corp',
        totalValue: 50000,
        uploadedAt: new Date('2025-06-01'),
        status: 'COMPLETED',
        artifacts: [],
      },
    ]);

    const request = createAuthenticatedRequest('http://localhost:3000/api/search', {
      query: 'NDA',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.results).toHaveLength(1);
    expect(data.data.results[0].title).toBe('NDA Agreement');
    expect(data.data.results[0].type).toBe('contract');
  });

  it('returns empty results for no matches', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('http://localhost:3000/api/search', {
      query: 'nonexistent',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.results).toEqual([]);
  });

  it('returns validation error for empty query', async () => {
    const request = createAuthenticatedRequest('http://localhost:3000/api/search', {
      query: '',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('applies filters to search', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('http://localhost:3000/api/search', {
      query: 'contract',
      filters: { status: 'completed' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );
  });
});
