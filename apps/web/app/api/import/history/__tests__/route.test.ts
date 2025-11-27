/**
 * Unit Tests for Import History API
 * Tests /api/import/history endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma - hoisted mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    importJob: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Import after mocking
import { GET } from '@/app/api/import/history/route';
import { prisma } from '@/lib/prisma';

// Get mocked prisma
const mockPrisma = vi.mocked(prisma);

describe('Import History API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return import jobs for a tenant', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        tenantId: 'tenant_demo_001',
        source: 'FILE_UPLOAD',
        status: 'COMPLETED',
        fileName: 'rate-card-2024.xlsx',
        fileSize: BigInt(102400),
        createdAt: new Date('2024-01-15'),
        startedAt: new Date('2024-01-15'),
        completedAt: new Date('2024-01-15'),
        rowsProcessed: 100,
        rowsSucceeded: 98,
        rowsFailed: 2,
        requiresReview: false,
        reviewedBy: null,
        reviewedAt: null,
        mappingConfidence: 0.95,
        errors: [],
        warnings: [],
        reviewNotes: null,
        rateCards: [
          { id: 'rc-1', supplierName: 'Acme Corp', _count: { entries: 50 } },
        ],
      },
    ];

    mockPrisma.importJob.findMany.mockResolvedValue(mockJobs);
    mockPrisma.importJob.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost/api/import/history', {
      headers: { 'x-tenant-id': 'tenant_demo_001' },
    });
    
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe('job-1');
    expect(data.data[0].status).toBe('COMPLETED');
    expect(data.data[0].totalRecords).toBe(100);
    expect(data.data[0].successfulRecords).toBe(98);
  });

  it('should support pagination', async () => {
    mockPrisma.importJob.findMany.mockResolvedValue([]);
    mockPrisma.importJob.count.mockResolvedValue(100);

    const request = new NextRequest('http://localhost/api/import/history?limit=20&offset=40', {
      headers: { 'x-tenant-id': 'tenant_demo_001' },
    });
    
    const response = await GET(request);
    const data = await response.json();

    expect(data.pagination).toBeDefined();
    expect(data.pagination.limit).toBe(20);
    expect(data.pagination.offset).toBe(40);
    expect(data.pagination.total).toBe(100);
    expect(data.pagination.hasMore).toBe(true);
  });

  it('should filter by status', async () => {
    mockPrisma.importJob.findMany.mockResolvedValue([]);
    mockPrisma.importJob.count.mockResolvedValue(0);

    const request = new NextRequest('http://localhost/api/import/history?status=COMPLETED', {
      headers: { 'x-tenant-id': 'tenant_demo_001' },
    });
    
    await GET(request);

    expect(mockPrisma.importJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'COMPLETED',
        }),
      })
    );
  });

  it('should handle empty results', async () => {
    mockPrisma.importJob.findMany.mockResolvedValue([]);
    mockPrisma.importJob.count.mockResolvedValue(0);

    const request = new NextRequest('http://localhost/api/import/history', {
      headers: { 'x-tenant-id': 'new-tenant' },
    });
    
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(0);
    expect(data.pagination.total).toBe(0);
  });

  it('should handle database errors', async () => {
    mockPrisma.importJob.findMany.mockRejectedValue(new Error('Connection refused'));

    const request = new NextRequest('http://localhost/api/import/history', {
      headers: { 'x-tenant-id': 'tenant_demo_001' },
    });
    
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });
});
