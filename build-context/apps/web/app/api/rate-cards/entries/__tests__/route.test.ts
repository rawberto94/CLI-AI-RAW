/**
 * Unit Tests for Rate Card Entries API
 * Tests /api/rate-cards/entries endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma - hoisted mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateCardEntry: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Import after mocking
import { GET } from '@/app/api/rate-cards/entries/route';
import { prisma } from '@/lib/prisma';

// Get mocked prisma
const mockPrisma = vi.mocked(prisma);

describe('Rate Card Entries API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/rate-cards/entries', () => {
    it('should return rate card entries for a tenant', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          role: 'Senior Developer',
          standardizedRole: 'Developer',
          seniority: 'SENIOR',
          dailyRate: 1200,
          currency: 'USD',
          country: 'USA',
          region: 'North America',
          lineOfService: 'IT',
          effectiveDate: new Date('2024-01-01'),
          volumeCommitted: 100,
          isNegotiated: true,
          confidence: 0.95,
          rateCardId: 'rc-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          rateCard: {
            id: 'rc-1',
            supplierName: 'Tech Partners Inc',
            supplierTier: 'TIER_1',
            effectiveDate: new Date('2024-01-01'),
            expiryDate: new Date('2024-12-31'),
          },
        },
      ];

      mockPrisma.rateCardEntry.findMany.mockResolvedValue(mockEntries);
      mockPrisma.rateCardEntry.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost/api/rate-cards/entries', {
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].roleOriginal).toBe('Senior Developer');
      expect(data.entries[0].supplierName).toBe('Tech Partners Inc');
    });

    it('should support pagination', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(250);

      const request = new NextRequest('http://localhost/api/rate-cards/entries?limit=50&offset=100', {
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.limit).toBe(50);
      expect(data.pagination.offset).toBe(100);
      expect(data.pagination.hasMore).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.rateCardEntry.findMany.mockRejectedValue(new Error('Database unavailable'));

      const request = new NextRequest('http://localhost/api/rate-cards/entries', {
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should handle empty results', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost/api/rate-cards/entries', {
        headers: { 'x-tenant-id': 'new-tenant' },
      });
      
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.entries).toHaveLength(0);
      expect(data.total).toBe(0);
    });
  });
});
