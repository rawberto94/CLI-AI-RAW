import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindMany,
  mockContractFindFirst,
  mockContractUpdate,
  mockUserFindUnique,
  mockUserFindMany,
  mockGetServerSession,
  mockGetServerTenantId,
  mockPublishRealtimeEvent,
} = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserFindMany: vi.fn(),
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
      findMany: mockUserFindMany,
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
import { PORTFOLIO_STATUSES } from '@/lib/contracts/server/portfolio';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * MS_PER_DAY);
}

function mockContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    contractTitle: 'NDA Contract',
    originalName: 'nda.pdf',
    fileName: 'nda.pdf',
    supplierName: 'Acme Corp',
    totalValue: 50000,
    startDate: null,
    effectiveDate: new Date('2025-01-01'),
    endDate: null,
    expirationDate: daysFromNow(45),
    contractType: 'NDA',
    category: null,
    autoRenewalEnabled: false,
    renewalStatus: null,
    renewalInitiatedBy: null,
    noticePeriodDays: null,
    artifacts: [],
    contractMetadata: null,
    workflowExecutions: [],
    ...overrides,
  };
}

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
      'x-user-role': 'admin',
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
    mockUserFindMany.mockResolvedValue([]);
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
    expect(data.data.renewals).toBeDefined();
    expect(data.data.renewals).toHaveLength(1);
    expect(data.data.stats).toBeDefined();
    expect(data.data.stats.total).toBe(1);
  });

  it('returns empty renewals when no contracts', async () => {
    mockContractFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.renewals).toEqual([]);
    expect(data.data.stats.total).toBe(0);
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

  it('queries portfolio contracts with a real expiration or end date', async () => {
    mockContractFindMany.mockResolvedValue([]);

    await GET(createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals'));

    const where = mockContractFindMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('test-tenant');
    expect(where.isDeleted).toBe(false);
    expect(where.status).toEqual({ in: PORTFOLIO_STATUSES });
    expect(where.OR).toEqual([
      { expirationDate: expect.objectContaining({ gte: expect.any(Date) }) },
      { AND: [{ expirationDate: null }, { endDate: expect.objectContaining({ gte: expect.any(Date) }) }] },
    ]);
  });

  it('skips contracts that have no expirationDate or endDate', async () => {
    mockContractFindMany.mockResolvedValue([
      mockContract({ id: 'undated', expirationDate: null, endDate: null }),
      mockContract({ id: 'dated', expirationDate: daysFromNow(20) }),
    ]);

    const response = await GET(createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals'));
    const data = await response.json();

    expect(data.data.renewals).toHaveLength(1);
    expect(data.data.renewals[0].contractId).toBe('dated');
    expect(data.data.renewals[0].daysUntilExpiry).not.toBe(365);
  });

  it('counts urgent as 0..30 days remaining and expired as its own bucket', async () => {
    mockContractFindMany.mockResolvedValue([
      mockContract({ id: 'expired', expirationDate: daysFromNow(-5) }),
      mockContract({ id: 'today', expirationDate: daysFromNow(0) }),
      mockContract({ id: 'soon', expirationDate: daysFromNow(20) }),
      mockContract({ id: 'later', expirationDate: daysFromNow(45) }),
    ]);

    const response = await GET(createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals'));
    const data = await response.json();
    const byId = Object.fromEntries(data.data.renewals.map((r: { contractId: string }) => [r.contractId, r]));

    expect(byId.expired.status).toBe('expired');
    expect(byId.today.status).not.toBe('expired');
    expect(data.data.stats.urgent).toBe(2);
    expect(data.data.stats.expired).toBe(1);
    expect(data.data.stats.expiringThisMonth).toBe(2);
  });

  it('dedupes by contractId and keeps distinct contracts that share a name', async () => {
    mockContractFindMany.mockResolvedValue([
      mockContract({ id: 'a', contractTitle: 'Shared MSA', expirationDate: daysFromNow(10) }),
      mockContract({ id: 'b', contractTitle: 'Shared MSA', expirationDate: daysFromNow(12) }),
      mockContract({ id: 'a', contractTitle: 'Shared MSA', expirationDate: daysFromNow(10) }),
    ]);

    const response = await GET(createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals'));
    const data = await response.json();

    expect(data.data.renewals.map((r: { contractId: string }) => r.contractId).sort()).toEqual(['a', 'b']);
  });

  it('does not treat a missing notice period as a synthesized critical deadline', async () => {
    mockContractFindMany.mockResolvedValue([
      mockContract({
        id: 'no-notice',
        expirationDate: daysFromNow(45),
        noticePeriodDays: null,
      }),
    ]);

    const response = await GET(createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals'));
    const data = await response.json();
    const renewal = data.data.renewals[0];

    expect(renewal.noticeDeadline).toBeNull();
    expect(renewal.noticeStatus).toBe('not-due');
    expect(renewal.priority).not.toBe('critical');
  });

  it('marks a real notice deadline critical only when overdue or within 14 days', async () => {
    mockContractFindMany.mockResolvedValue([
      mockContract({
        id: 'overdue-notice',
        expirationDate: daysFromNow(20),
        noticePeriodDays: 60,
      }),
      mockContract({
        id: 'soon-notice',
        expirationDate: daysFromNow(70),
        noticePeriodDays: 60,
      }),
      mockContract({
        id: 'later-notice',
        expirationDate: daysFromNow(90),
        noticePeriodDays: 60,
      }),
    ]);

    const response = await GET(createAuthenticatedRequest('GET', 'http://localhost:3000/api/renewals'));
    const data = await response.json();
    const byId = Object.fromEntries(data.data.renewals.map((r: { contractId: string }) => [r.contractId, r]));

    expect(byId['overdue-notice'].noticeStatus).toBe('overdue');
    expect(byId['overdue-notice'].priority).toBe('critical');
    expect(byId['soon-notice'].noticeStatus).toBe('pending');
    expect(byId['soon-notice'].priority).toBe('critical');
    expect(byId['later-notice'].noticeStatus).toBe('not-due');
    expect(byId['later-notice'].priority).not.toBe('critical');
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
