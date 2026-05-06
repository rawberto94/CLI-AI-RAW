import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockArtifactFindMany,
  mockContractFindFirst,
  mockCostSavingsFindMany,
} = vi.hoisted(() => ({
  mockArtifactFindMany: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockCostSavingsFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    artifact: {
      findMany: mockArtifactFindMany,
    },
    costSavingsOpportunity: {
      findMany: mockCostSavingsFindMany,
    },
  },
}));

vi.mock('@/lib/security/contract-acl', () => ({
  checkContractWritePermission: vi.fn(),
  checkContractReadPermission: vi.fn(),
}));

vi.mock('@/lib/services/contract-deletion.service', () => ({
  safeDeleteContract: vi.fn(),
}));

vi.mock('@/lib/ai/semantic-cache.service', () => ({
  semanticCache: {
    invalidate: vi.fn(),
  },
}));

vi.mock('@/lib/cache', () => ({
  deleteCachedByPattern: vi.fn(),
}));

vi.mock('@/lib/cache/etag-cache', () => ({
  contractCache: {
    get: vi.fn(),
    matches: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  apiCache: {
    invalidate: vi.fn(),
  },
  etagHeaders: vi.fn(() => ({})),
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: vi.fn(),
  AuditAction: {
    CONTRACT_UPDATED: 'CONTRACT_UPDATED',
    CONTRACT_DELETED: 'CONTRACT_DELETED',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { GET } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(withAuth = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/details', {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('/api/contracts/[id]/details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCostSavingsFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is outside the tenant scope', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest(true), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns frontend-shaped details and scopes savings by tenant', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      fileName: 'msa.pdf',
      status: 'COMPLETED',
      createdAt: new Date('2026-04-29T12:00:00.000Z'),
      artifacts: [
        {
          type: 'OVERVIEW',
          data: { completeness: 90, method: 'ai', processingTime: 12 },
          confidence: 0.87,
        },
      ],
    });
    mockCostSavingsFindMany.mockResolvedValue([
      {
        id: 'opp-1',
        category: 'pricing',
        title: 'Rate alignment',
        description: 'Renegotiate hourly rates',
        potentialSavingsAmount: 75000,
        potentialSavingsCurrency: 'USD',
        potentialSavingsPercentage: 12,
        timeframe: 'annual',
        confidence: 'high',
        effort: 'low',
        priority: 'high',
        actionItems: ['Review pricing'],
        implementationTimeline: '30 days',
        risks: ['Supplier pushback'],
      },
    ]);

    const response = await GET(createRequest(true), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
    }));
    expect(mockCostSavingsFindMany).toHaveBeenCalledWith({
      where: {
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        status: 'identified',
      },
      orderBy: {
        potentialSavingsAmount: 'desc',
      },
    });
    expect(data.data.data.name).toBe('msa.pdf');
    expect(data.data.data.costSavings.summary.opportunityCount).toBe(1);
  });
});