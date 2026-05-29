import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockHasPermission, mockQueryRaw } = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: mockHasPermission,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

import { GET } from '../route';

function createRequest(role: string, path = '/api/audit-logs'): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': role,
    },
  });
}

async function readTextResponse(response: any): Promise<string> {
  if (typeof response.text === 'function') {
    return response.text();
  }

  return new Response(response.body).text();
}

describe('Audit Logs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(false);
  });

  it('returns 403 for requests without audit:view permission before querying audit logs', async () => {
    const response = await GET(createRequest('member'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockHasPermission).toHaveBeenCalledWith('user-1', 'audit:view');
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('requires audit:export permission for CSV exports', async () => {
    mockHasPermission.mockImplementation(async (_userId: string, permission: string) => permission === 'audit:view');

    const response = await GET(createRequest('admin', '/api/audit-logs?export=csv'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(mockHasPermission).toHaveBeenCalledWith('user-1', 'audit:view');
    expect(mockHasPermission).toHaveBeenCalledWith('user-1', 'audit:export');
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('exports filtered audit logs as escaped CSV', async () => {
    mockHasPermission.mockResolvedValue(true);
    mockQueryRaw.mockResolvedValueOnce([
      {
        createdAt: new Date('2026-05-29T10:00:00.000Z'),
        action: 'contract.read',
        category: 'contract',
        success: true,
        actorName: 'Alice Admin',
        actorEmail: 'alice@example.com',
        actorRole: 'admin',
        resourceType: 'contract',
        resourceId: 'contract-1',
        resourceName: 'MSA "Swiss"',
        ipAddress: '127.0.0.1',
        userAgent: 'Browser\nAgent',
        errorMessage: null,
      },
    ]);

    const response = await GET(createRequest('admin', '/api/audit-logs?export=csv&category=contract&success=true&search=MSA'));
    const body = await readTextResponse(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain('audit-logs-');
    expect(body).toContain('Timestamp,Action,Category,Success,Actor Name,Actor Email');
    expect(body).toContain('"2026-05-29T10:00:00.000Z","contract.read","contract","Yes"');
    expect(body).toContain('"MSA ""Swiss"""');
    expect(body).toContain('"Browser Agent"');
    expect(mockHasPermission).toHaveBeenCalledWith('user-1', 'audit:view');
    expect(mockHasPermission).toHaveBeenCalledWith('user-1', 'audit:export');
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });
});