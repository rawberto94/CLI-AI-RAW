import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockPrisma: {
    integration: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    syncLog: { create: vi.fn() },
  },
  mockMonitoringService: {},
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.mockPrisma }));
vi.mock('data-orchestration/services', () => ({ monitoringService: mocks.mockMonitoringService }));

import { GET, POST, DELETE } from '../route';

function req(method = 'GET', url = 'http://localhost:3000/api/integrations', body?: Record<string, unknown>, hdrs?: Record<string, string>) {
  const h: Record<string, string> = { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', ...hdrs };
  const opts: any = { method, headers: h };
  if (body) { opts.body = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
  return new NextRequest(url, opts);
}

describe('GET /api/integrations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without auth', async () => {
    const r = new NextRequest('http://localhost:3000/api/integrations', { method: 'GET', headers: { 'x-tenant-id': 't' } } as any);
    const res = await GET(r);
    expect(res.status).toBe(401);
  });

  it('should return integrations list', async () => {
    const integrations = [
      { id: 'i1', name: 'Slack', status: 'CONNECTED', type: 'COMMUNICATION', provider: 'Slack', recordsProcessed: 100, syncLogs: [] },
      { id: 'i2', name: 'Drive', status: 'DISCONNECTED', type: 'STORAGE', provider: 'Google', recordsProcessed: 0, syncLogs: [] },
    ];
    mocks.mockPrisma.integration.findMany.mockResolvedValue(integrations);

    const res = await GET(req());
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.data.data.integrations.length).toBe(2);
    expect(d.data.data.stats.connected).toBe(1);
    expect(d.data.data.stats.disconnected).toBe(1);
  });

  it('should return single integration by id', async () => {
    mocks.mockPrisma.integration.findFirst.mockResolvedValue({ id: 'i1', name: 'Slack', status: 'CONNECTED', syncLogs: [] });
    const res = await GET(req('GET', 'http://localhost:3000/api/integrations?id=i1'));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.data.data.name).toBe('Slack');
  });

  it('should return 404 for unknown integration id', async () => {
    mocks.mockPrisma.integration.findFirst.mockResolvedValue(null);
    const res = await GET(req('GET', 'http://localhost:3000/api/integrations?id=unknown'));
    expect(res.status).toBe(404);
  });

  it('should handle db error gracefully', async () => {
    mocks.mockPrisma.integration.findMany.mockRejectedValue(new Error('db'));
    const res = await GET(req());
    expect(res.status).toBe(500);
  });
});

describe('POST /api/integrations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should create integration', async () => {
    mocks.mockPrisma.integration.create.mockResolvedValue({ id: 'new', name: 'New Int', type: 'OTHER', status: 'DISCONNECTED' });
    const res = await POST(req('POST', 'http://localhost:3000/api/integrations', { action: 'create', name: 'New Int', type: 'OTHER', provider: 'Custom' }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
  });

  it('should connect integration', async () => {
    mocks.mockPrisma.integration.findFirst.mockResolvedValue({ id: 'i1', status: 'DISCONNECTED', tenantId: 'test-tenant' });
    mocks.mockPrisma.integration.update.mockResolvedValue({ id: 'i1', status: 'CONNECTED' });
    const res = await POST(req('POST', 'http://localhost:3000/api/integrations', { action: 'connect', integrationId: 'i1' }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.data.message).toBe('Integration connected');
  });

  it('should test connection', async () => {
    const res = await POST(req('POST', 'http://localhost:3000/api/integrations', { action: 'test', integrationId: 'i1' }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.data.data.testResult).toBe('success');
  });

  it('should return 400 for invalid action', async () => {
    const res = await POST(req('POST', 'http://localhost:3000/api/integrations', { action: 'invalid' }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/integrations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 without id', async () => {
    const res = await DELETE(req('DELETE'));
    expect(res.status).toBe(400);
  });

  it('should delete integration', async () => {
    mocks.mockPrisma.integration.findFirst.mockResolvedValue({ id: 'i1' });
    mocks.mockPrisma.integration.delete.mockResolvedValue({});
    const res = await DELETE(req('DELETE', 'http://localhost:3000/api/integrations?id=i1'));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
  });
});
