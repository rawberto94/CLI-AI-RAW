import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockHasPermission,
  mockTenantConfigFindUnique,
  mockTenantConfigUpsert,
  mockIpAllowlistFindMany,
  mockAuditLog,
} = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockTenantConfigFindUnique: vi.fn(),
  mockTenantConfigUpsert: vi.fn(),
  mockIpAllowlistFindMany: vi.fn(),
  mockAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantConfig: {
      findUnique: mockTenantConfigFindUnique,
      upsert: mockTenantConfigUpsert,
    },
    ipAllowlist: {
      findMany: mockIpAllowlistFindMany,
    },
  },
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: mockHasPermission,
}));

vi.mock('data-orchestration/services', () => ({
  auditTrailService: {},
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: mockAuditLog,
  AuditAction: {
    SECURITY_SETTINGS_UPDATED: 'SECURITY_SETTINGS_UPDATED',
    IP_ALLOWLIST_ADDED: 'IP_ALLOWLIST_ADDED',
    IP_ALLOWLIST_REMOVED: 'IP_ALLOWLIST_REMOVED',
  },
  getAuditContext: vi.fn(() => ({})),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { GET, POST } from '../route';

function createRequest(method: 'GET' | 'POST', body?: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/security/ip-allowlist', {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'admin',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  } as RequestInit);
}

describe('Admin IP allowlist API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
    mockTenantConfigFindUnique.mockResolvedValue(null);
    mockTenantConfigUpsert.mockResolvedValue(undefined);
    mockIpAllowlistFindMany.mockResolvedValue([]);
  });

  it('reads the canonical tenant config flag without consulting legacy security settings', async () => {
    mockTenantConfigFindUnique.mockResolvedValue({
      securitySettings: { ipAllowlistEnabled: true },
    });

    const response = await GET(createRequest('GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.enabled).toBe(true);
  });

  it('writes the ip allowlist toggle back to tenant config instead of the legacy table', async () => {
    mockTenantConfigFindUnique.mockResolvedValue({
      securitySettings: { sessionTimeout: 8 },
    });

    const response = await POST(createRequest('POST', { action: 'updateSettings', enabled: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.updated).toBe(true);
    expect(mockTenantConfigUpsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      create: {
        tenantId: 'tenant-1',
        securitySettings: {
          sessionTimeout: 8,
          ipAllowlistEnabled: true,
        },
      },
      update: {
        securitySettings: {
          sessionTimeout: 8,
          ipAllowlistEnabled: true,
        },
      },
    });
  });
});