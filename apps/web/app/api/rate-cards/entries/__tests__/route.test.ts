import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany, mockCount } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateCardEntry: {
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: vi.fn().mockResolvedValue('test-tenant'),
}));

vi.mock('data-orchestration/services', () => ({
  rateCardEntryService: {},
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

describe('GET /api/rate-cards/entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/rate-cards/entries');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns rate card entries', async () => {
    const now = new Date();
    mockFindMany.mockResolvedValue([
      {
        id: 'rce-1',
        roleOriginal: 'Software Engineer',
        roleStandardized: 'Software Engineer',
        seniority: 'MID',
        supplierName: 'TechCorp',
        supplierTier: 'TIER_1',
        dailyRateUSD: 800,
        currency: 'USD',
        country: 'US',
        region: 'North America',
        lineOfService: 'Technology',
        effectiveDate: now,
        expiryDate: null,
        volumeCommitted: 10,
        isNegotiated: true,
        confidence: 0.9,
        source: 'CONTRACT',
        supplierId: 'sup-1',
        createdAt: now,
        updatedAt: now,
        supplier: { id: 'sup-1', name: 'TechCorp', tier: 'TIER_1' },
        dailyRate: 800,
      },
    ]);
    mockCount.mockResolvedValue(1);

    const request = createAuthenticatedRequest('http://localhost:3000/api/rate-cards/entries');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.entries).toHaveLength(1);
    expect(data.data.entries[0].roleOriginal).toBe('Software Engineer');
    expect(data.data.total).toBe(1);
    expect(data.data.pagination).toBeDefined();
  });

  it('returns empty entries', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const request = createAuthenticatedRequest('http://localhost:3000/api/rate-cards/entries');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.entries).toEqual([]);
    expect(data.data.total).toBe(0);
  });

  it('applies role filter', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const request = createAuthenticatedRequest('http://localhost:3000/api/rate-cards/entries', {
      searchParams: { roles: 'Developer' },
    });
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ roleOriginal: expect.any(Object) }),
          ]),
        }),
      })
    );
  });

  it('handles database error gracefully', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'));

    const request = createAuthenticatedRequest('http://localhost:3000/api/rate-cards/entries');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });
});
