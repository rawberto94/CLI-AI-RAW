import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockContractUserAccessFindMany,
  mockContractGroupAccessFindMany,
  mockContractUserAccessFindFirst,
  mockUserGroupMemberFindMany,
  mockContractGroupAccessFindFirst,
  mockHasPermission,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractUserAccessFindMany: vi.fn(),
  mockContractGroupAccessFindMany: vi.fn(),
  mockContractUserAccessFindFirst: vi.fn(),
  mockUserGroupMemberFindMany: vi.fn(),
  mockContractGroupAccessFindFirst: vi.fn(),
  mockHasPermission: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    contractUserAccess: {
      findMany: mockContractUserAccessFindMany,
      findFirst: mockContractUserAccessFindFirst,
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    contractGroupAccess: {
      findMany: mockContractGroupAccessFindMany,
      findFirst: mockContractGroupAccessFindFirst,
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    userGroupMember: {
      findMany: mockUserGroupMemberFindMany,
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    userGroup: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: mockHasPermission,
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: vi.fn(),
  AuditAction: {
    CONTRACT_ACCESS_GRANTED: 'CONTRACT_ACCESS_GRANTED',
    CONTRACT_ACCESS_REVOKED: 'CONTRACT_ACCESS_REVOKED',
  },
}));

vi.mock('@/lib/email/email-service', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/email/templates', () => ({
  emailTemplates: {
    contractAccessGranted: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { GET, POST } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(method: 'GET' | 'POST', body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/access', {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'admin',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/[id]/access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractUserAccessFindMany.mockResolvedValue([]);
    mockContractGroupAccessFindMany.mockResolvedValue([]);
    mockUserGroupMemberFindMany.mockResolvedValue([]);
    mockContractUserAccessFindFirst.mockResolvedValue(null);
    mockContractGroupAccessFindFirst.mockResolvedValue(null);
  });

  it('returns 404 when the contract is not in the tenant scope', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when the caller cannot manage access', async () => {
    mockHasPermission.mockResolvedValue(false);

    const response = await POST(
      createRequest('POST', { userIds: ['user-2'], accessLevel: 'view' }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
  });
});