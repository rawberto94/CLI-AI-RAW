import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractActivityCreate,
  mockContractFindFirst,
  mockUserPreferencesCreate,
  mockUserPreferencesFindUnique,
  mockUserPreferencesUpdate,
} = vi.hoisted(() => ({
  mockContractActivityCreate: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockUserPreferencesCreate: vi.fn(),
  mockUserPreferencesFindUnique: vi.fn(),
  mockUserPreferencesUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    userPreferences: {
      create: mockUserPreferencesCreate,
      findUnique: mockUserPreferencesFindUnique,
      update: mockUserPreferencesUpdate,
    },
    contractActivity: {
      create: mockContractActivityCreate,
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

import { GET, POST } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(
  method: 'GET' | 'POST',
  withAuth = true,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/favorite', {
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

describe('/api/contracts/[id]/favorite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockUserPreferencesFindUnique.mockResolvedValue(null);
    mockUserPreferencesCreate.mockResolvedValue({ userId: 'user-1', customSettings: {} });
    mockUserPreferencesUpdate.mockResolvedValue(undefined);
    mockContractActivityCreate.mockResolvedValue(undefined);
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest('GET', false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when favorite state is requested for a contract outside the tenant scope', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET', true), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns false when the user has no preferences yet', async () => {
    const response = await GET(createRequest('GET', true), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.favorite).toBe(false);
  });

  it('creates preferences and stores favorite contracts', async () => {
    const response = await POST(createRequest('POST', true, { favorite: true }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUserPreferencesCreate).toHaveBeenCalled();
    expect(mockUserPreferencesUpdate).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        customSettings: {
          favoriteContracts: ['contract-1'],
        },
      },
    });
    expect(mockContractActivityCreate).toHaveBeenCalled();
  });
});