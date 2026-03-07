/**
 * Unit Tests for Analytics Dashboard API
 * Tests /api/analytics/dashboard endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma - hoisted mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// Import after mocking
import { GET } from '@/app/api/analytics/dashboard/route';
import { prisma } from '@/lib/prisma';

// Get mocked prisma
const mockPrisma = vi.mocked(prisma);

describe('Analytics Dashboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock implementations
    mockPrisma.contract.count.mockResolvedValue(50);
    mockPrisma.contract.aggregate.mockResolvedValue({ 
      _sum: { totalValue: 5000000 }, 
      _avg: { totalValue: 100000 } 
    });
    mockPrisma.contract.groupBy.mockResolvedValue([
      { status: 'ACTIVE', _count: { id: 30 } },
      { status: 'COMPLETED', _count: { id: 15 } },
      { status: 'PENDING', _count: { id: 5 } },
    ]);
  });

  it('should return dashboard metrics', async () => {
    const request = new NextRequest('http://localhost/api/analytics/dashboard?timeframe=30d');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.timeframe).toBe('30d');
    expect(data.metrics).toBeDefined();
    expect(data.metrics.totalContracts).toBe(50);
  });

  it('should handle different timeframes', async () => {
    const timeframes = ['7d', '30d', '90d', '1y'];
    
    for (const timeframe of timeframes) {
      const request = new NextRequest(`http://localhost/api/analytics/dashboard?timeframe=${timeframe}`);
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.timeframe).toBe(timeframe);
    }
  });

  it('should include status distribution in response', async () => {
    const request = new NextRequest('http://localhost/api/analytics/dashboard');
    const response = await GET(request);
    const data = await response.json();

    expect(data.metrics.statusDistribution).toBeDefined();
    expect(data.metrics.statusDistribution.ACTIVE).toBe(30);
    expect(data.metrics.statusDistribution.COMPLETED).toBe(15);
    expect(data.metrics.statusDistribution.PENDING).toBe(5);
  });

  it('should return period dates in response', async () => {
    const request = new NextRequest('http://localhost/api/analytics/dashboard');
    const response = await GET(request);
    const data = await response.json();

    expect(data.period).toBeDefined();
    expect(data.period.start).toBeDefined();
    expect(data.period.end).toBeDefined();
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.contract.count.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost/api/analytics/dashboard');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('should filter by tenantId when provided', async () => {
    const request = new NextRequest('http://localhost/api/analytics/dashboard?tenantId=tenant-123');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(mockPrisma.contract.count).toHaveBeenCalled();
  });
});
