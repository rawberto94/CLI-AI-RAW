import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockPrisma: {
    importJob: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  mockArtifactService: {},
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.mockPrisma }));
vi.mock('data-orchestration/services', () => ({ artifactService: mocks.mockArtifactService }));

import { GET } from '../route';

function req(url = 'http://localhost:3000/api/import/history', hdrs?: Record<string, string>) {
  const h: Record<string, string> = { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1', ...hdrs };
  return new NextRequest(url, { method: 'GET', headers: h } as any);
}

describe('Import History API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without auth', async () => {
    const r = new NextRequest('http://localhost:3000/api/import/history', { method: 'GET', headers: { 'x-tenant-id': 't' } } as any);
    const res = await GET(r);
    expect(res.status).toBe(401);
  });

  it('should return import jobs for a tenant', async () => {
    const jobs = [{
      id: 'j1', fileName: 'data.csv', fileSize: 1024, source: 'upload', status: 'COMPLETED',
      createdAt: new Date(), startedAt: new Date(), completedAt: new Date(),
      rowsProcessed: 100, rowsSucceeded: 95, rowsFailed: 5,
      requiresReview: false, reviewedBy: null, reviewedAt: null,
      mappingConfidence: 0.9, errors: [], warnings: [], reviewNotes: null,
      rateCards: [{ id: 'rc1', supplierName: 'Acme', _count: { roles: 10 } }],
    }];
    mocks.mockPrisma.importJob.findMany.mockResolvedValue(jobs);
    mocks.mockPrisma.importJob.count.mockResolvedValue(1);

    const res = await GET(req());
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    expect(d.data.data.length).toBe(1);
    expect(d.data.data[0].fileName).toBe('data.csv');
    expect(d.data.pagination.total).toBe(1);
  });

  it('should support pagination', async () => {
    mocks.mockPrisma.importJob.findMany.mockResolvedValue([]);
    mocks.mockPrisma.importJob.count.mockResolvedValue(100);

    const res = await GET(req('http://localhost:3000/api/import/history?limit=10&offset=20'));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.data.pagination.limit).toBe(10);
    expect(d.data.pagination.offset).toBe(20);
    expect(d.data.pagination.hasMore).toBe(true);
  });

  it('should filter by status', async () => {
    mocks.mockPrisma.importJob.findMany.mockResolvedValue([]);
    mocks.mockPrisma.importJob.count.mockResolvedValue(0);

    await GET(req('http://localhost:3000/api/import/history?status=COMPLETED'));
    expect(mocks.mockPrisma.importJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED' }) })
    );
  });

  it('should handle empty results', async () => {
    mocks.mockPrisma.importJob.findMany.mockResolvedValue([]);
    mocks.mockPrisma.importJob.count.mockResolvedValue(0);

    const res = await GET(req());
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.data.data).toEqual([]);
  });

  it('should handle database errors', async () => {
    mocks.mockPrisma.importJob.findMany.mockRejectedValue(new Error('db error'));
    const res = await GET(req());
    expect(res.status).toBe(500);
  });
});
