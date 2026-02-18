import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockContractFindMany, mockArtifactFindMany, mockAuditLogFindMany } = vi.hoisted(() => ({
  mockContractFindMany: vi.fn(),
  mockArtifactFindMany: vi.fn(),
  mockAuditLogFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: mockContractFindMany,
    },
    artifact: {
      findMany: mockArtifactFindMany,
    },
    auditLog: {
      findMany: mockAuditLogFindMany,
    },
  },
}));

vi.mock('@/lib/tenant-server', () => ({
  getTenantIdFromRequest: vi.fn().mockResolvedValue('test-tenant'),
}));

vi.mock('data-orchestration/services', () => ({
  analyticalIntelligenceService: {},
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

describe('GET /api/intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks for health scores
    mockContractFindMany.mockResolvedValue([]);
    mockArtifactFindMany.mockResolvedValue([]);
    mockAuditLogFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/intelligence');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns all intelligence sections by default', async () => {
    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/intelligence');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.healthScores).toBeDefined();
    expect(data.data.data.insights).toBeDefined();
    expect(data.data.data.recentActivity).toBeDefined();
    expect(data.data.data.aiCapabilities).toBeDefined();
  });

  it('returns only health section when requested', async () => {
    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/intelligence', {
      searchParams: { section: 'health' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.healthScores).toBeDefined();
  });

  it('returns correct health score distribution', async () => {
    mockContractFindMany.mockResolvedValue([
      { id: 'c1', metadata: { healthScore: 90 } },
      { id: 'c2', metadata: { healthScore: 50 } },
      { id: 'c3', metadata: { healthScore: 30 } },
    ]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/intelligence', {
      searchParams: { section: 'health' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const hs = data.data.data.healthScores;
    expect(hs.healthy).toBe(1);
    expect(hs.atRisk).toBe(1);
    expect(hs.critical).toBe(1);
  });
});

describe('POST /api/intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/intelligence');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('handles refresh-scores action', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/intelligence', {
      body: { action: 'refresh-scores' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.status).toBe('processing');
  });

  it('handles dismiss-insight action', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/intelligence', {
      body: { action: 'dismiss-insight', insightId: 'insight-1' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.insightId).toBe('insight-1');
  });

  it('returns 400 for invalid action', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/intelligence', {
      body: { action: 'invalid' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });
});
