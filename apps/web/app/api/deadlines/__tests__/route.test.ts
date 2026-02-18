import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany, mockGetDb, mockGetApiTenantId, mockGetServerSession } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockGetDb: vi.fn(),
  mockGetApiTenantId: vi.fn(),
  mockGetServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: mockGetDb,
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: mockGetApiTenantId,
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: mockGetServerSession,
}));

import { GET } from '../route';

function createAuthenticatedRequest(
  url: string,
  options?: { searchParams?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url);
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
  }
  return new NextRequest(fullUrl.toString(), {
    method: 'GET',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
  });
}

function createUnauthenticatedRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/deadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue({
      contract: { findMany: mockFindMany },
    });
    mockGetApiTenantId.mockResolvedValue('test-tenant');
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', tenantId: 'test-tenant', email: 'test@example.com' },
    });
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/deadlines');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns deadlines from contracts', async () => {
    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days from now
    mockFindMany.mockResolvedValue([
      {
        id: 'c1',
        fileName: 'Contract A',
        clientName: 'Acme',
        supplierName: 'Vendor',
        effectiveDate: null,
        startDate: null,
        endDate: null,
        expirationDate: futureDate,
        totalValue: 10000,
        currency: 'USD',
        contractType: 'NDA',
        status: 'ACTIVE',
      },
    ]);

    const request = createAuthenticatedRequest('http://localhost:3000/api/deadlines');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.deadlines).toBeDefined();
    expect(data.data.deadlines.length).toBeGreaterThan(0);
    expect(data.data.source).toBe('database');
    expect(data.data.stats).toBeDefined();
    expect(data.data.stats.total).toBeGreaterThan(0);
  });

  it('returns empty deadlines when no contracts', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('http://localhost:3000/api/deadlines');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.deadlines).toEqual([]);
    expect(data.data.stats.total).toBe(0);
  });

  it('filters by type', async () => {
    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    mockFindMany.mockResolvedValue([
      {
        id: 'c1',
        fileName: 'Contract A',
        clientName: null,
        supplierName: null,
        effectiveDate: null,
        startDate: null,
        endDate: null,
        expirationDate: futureDate,
        totalValue: null,
        currency: null,
        contractType: 'NDA',
        status: 'ACTIVE',
      },
    ]);

    const request = createAuthenticatedRequest('http://localhost:3000/api/deadlines', {
      searchParams: { type: 'expiration' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Only expiration type should be returned
    data.data.deadlines.forEach((d: { type: string }) => {
      expect(d.type).toBe('expiration');
    });
  });

  it('returns 503 when database unavailable', async () => {
    mockGetDb.mockResolvedValue({
      contract: {
        findMany: vi.fn().mockRejectedValue(new Error('DB down')),
      },
    });

    const request = createAuthenticatedRequest('http://localhost:3000/api/deadlines');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
