import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindMany, mockContractFindFirst, mockContractUpdate, mockUserFindUnique, mockGetServerSession, mockGetServerTenantId, mockPublishRealtimeEvent } = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockGetServerSession: vi.fn(),
  mockGetServerTenantId: vi.fn(),
  mockPublishRealtimeEvent: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
      findFirst: mockContractFindFirst,
      update: mockContractUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock('@/lib/tenant-server', () => ({
  getServerTenantId: mockGetServerTenantId,
}));

vi.mock('@/lib/realtime/publish', () => ({
  publishRealtimeEvent: mockPublishRealtimeEvent,
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { GET, POST } from '../route';

function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: { body?: object; searchParams?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url);
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
  }
  return new NextRequest(fullUrl.toString(), {
    method,
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

function createUnauthenticatedRequest(method: string, url: string): NextRequest {
  return new NextRequest(url, { method });
}

describe('GET /api/renewals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', tenantId: 'test-tenant', email: 'test@example.com' },
    });
    mockGetServerTenantId.mockResolvedValue('test-tenant');
    mockPublishRealtimeEvent.mockResolvedValue(undefined);
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/renewals');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns renewals list with stats', async () => {
    const futureDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
    mockContractFindMany.mockResolvedValue([
      {
        id: 'c1',
        contractTitle: 'NDA Contract',
        originalName: 'nda.pdf',
        fileName: 'nda.pdf',
        supplierName: 'Acme Corp',
        totalValue: 50000,
        startDate: null,
        effectiveDate: new Date('2025-01-01'),
        endDate: null,
        expirationDate: futureDate,
        contractType: 'NDA',
        category: null,
        autoRenewalEnabled: false,
        renewalStatus: null,
        renewalInitiatedBy: null,
        artifacts: [],
        contractMetadata: null,
        workflowExecutions: [],
      },
    ]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.renewals).toBeDefined();
    expect(data.data.data.renewals).toHaveLength(1);
    expect(data.data.data.stats).toBeDefined();
    expect(data.data.data.stats.total).toBe(1);
  });

  it('returns empty renewals when no contracts', async () => {
    mockContractFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.renewals).toEqual([]);
    expect(data.data.data.stats.total).toBe(0);
  });

  it('filters by status', async () => {
    mockContractFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals', {
      searchParams: { status: 'urgent' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe('POST /api/renewals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', tenantId: 'test-tenant', email: 'test@example.com' },
    });
    mockGetServerTenantId.mockResolvedValue('test-tenant');
    mockPublishRealtimeEvent.mockResolvedValue(undefined);
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/renewals');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('returns 404 when contract not found', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/renewals', {
      body: { contractId: 'non-existent', action: 'initiate' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('initiates renewal for existing contract', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'c1', autoRenewalEnabled: false });
    mockContractUpdate.mockResolvedValue({ id: 'c1' });

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/renewals', {
      body: { contractId: 'c1', action: 'initiate' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
