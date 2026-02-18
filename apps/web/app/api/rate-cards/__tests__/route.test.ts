/**
 * Unit Tests for Rate Cards API
 * Tests /api/rate-cards endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany, mockCount, mockCreate } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateCardEntry: {
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  rateCardManagementService: {},
}));

import { GET, POST } from '../route';

function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: { body?: object }
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

function createUnauthenticatedRequest(method: string, url: string): NextRequest {
  return new NextRequest(url, { method });
}

const mockRateCards = [
  {
    id: 'rate-1',
    tenantId: 'tenant-1',
    contractId: 'contract-1',
    supplierId: 'supplier-1',
    supplierName: 'Accenture',
    roleOriginal: 'Senior Software Engineer',
    roleStandardized: 'Software Engineer',
    seniority: 'SENIOR',
    lineOfService: 'Technology',
    country: 'United States',
    region: 'North America',
    dailyRate: 1200.0,
    currency: 'USD',
    effectiveDate: new Date('2024-01-01'),
    expiryDate: new Date('2025-12-31'),
    isBaseline: true,
    isNegotiated: true,
    source: 'EXTRACTED',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    contract: { id: 'contract-1', fileName: 'accenture-rates.pdf', clientName: 'Acme Corp' },
  },
  {
    id: 'rate-2',
    tenantId: 'tenant-1',
    contractId: 'contract-1',
    supplierId: 'supplier-1',
    supplierName: 'Accenture',
    roleOriginal: 'Principal Architect',
    roleStandardized: 'Solution Architect',
    seniority: 'PRINCIPAL',
    lineOfService: 'Technology',
    country: 'United States',
    region: 'North America',
    dailyRate: 1800.0,
    currency: 'USD',
    effectiveDate: new Date('2024-01-01'),
    expiryDate: new Date('2025-12-31'),
    isBaseline: true,
    isNegotiated: false,
    source: 'EXTRACTED',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    contract: { id: 'contract-1', fileName: 'accenture-rates.pdf', clientName: 'Acme Corp' },
  },
  {
    id: 'rate-3',
    tenantId: 'tenant-1',
    contractId: 'contract-2',
    supplierId: 'supplier-2',
    supplierName: 'Deloitte',
    roleOriginal: 'Data Scientist',
    roleStandardized: 'Data Scientist',
    seniority: 'SENIOR',
    lineOfService: 'Data & Analytics',
    country: 'United States',
    region: 'North America',
    dailyRate: 1400.0,
    currency: 'USD',
    effectiveDate: new Date('2024-01-01'),
    expiryDate: new Date('2025-12-31'),
    isBaseline: false,
    isNegotiated: true,
    source: 'MANUAL',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    contract: { id: 'contract-2', fileName: 'deloitte-rates.pdf', clientName: 'Widget Co' },
  },
];

describe('Rate Cards API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/rate-cards', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns rate cards for authenticated tenant', async () => {
      mockFindMany.mockResolvedValue(mockRateCards);
      mockCount.mockResolvedValue(3);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data).toHaveLength(3);
      expect(data.data.page).toBe(1);
      expect(data.data.pageSize).toBe(50);
    });

    it('returns total and pagination info', async () => {
      mockFindMany.mockResolvedValue(mockRateCards);
      mockCount.mockResolvedValue(3);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.total).toBe(3);
      expect(data.data.originalTotal).toBe(3);
      expect(data.data.totalPages).toBe(1);
    });

    it('handles pagination parameters', async () => {
      mockFindMany.mockResolvedValue([mockRateCards[0]]);
      mockCount.mockResolvedValue(100);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?page=2&pageSize=25');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.page).toBe(2);
      expect(data.data.pageSize).toBe(25);
      expect(data.data.totalPages).toBe(4);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 25, take: 25 })
      );
    });

    it('filters by contractId', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?contractId=c1');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contractId: 'c1' }),
        })
      );
    });

    it('filters by supplierName with insensitive contains', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?supplierName=Accenture');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplierName: { contains: 'Accenture', mode: 'insensitive' },
          }),
        })
      );
    });

    it('filters by seniority', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?seniority=SENIOR');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ seniority: 'SENIOR' }),
        })
      );
    });

    it('filters by country', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?country=United%20States');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ country: 'United States' }),
        })
      );
    });

    it('filters by source', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?source=MANUAL');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source: 'MANUAL' }),
        })
      );
    });

    it('filters by minRate and maxRate', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?minRate=1000&maxRate=2000');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dailyRate: { gte: 1000, lte: 2000 },
          }),
        })
      );
    });

    it('filters by isBaseline=true', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?isBaseline=true');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isBaseline: true }),
        })
      );
    });

    it('filters by isBaseline=false', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?isBaseline=false');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isBaseline: false }),
        })
      );
    });

    it('filters by isNegotiated=true', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?isNegotiated=true');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isNegotiated: true }),
        })
      );
    });

    it('handles sorting parameters', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?sortBy=dailyRate&sortOrder=asc');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { dailyRate: 'asc' },
        })
      );
    });

    it('includes contract relation in query', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            contract: {
              select: { id: true, fileName: true, clientName: true },
            },
          },
        })
      );
    });

    it('deduplicates rate cards by role, seniority, rate, and supplier', async () => {
      const duplicateCards = [
        { ...mockRateCards[0] },
        { ...mockRateCards[0], id: 'rate-dup' },
      ];
      mockFindMany.mockResolvedValue(duplicateCards);
      mockCount.mockResolvedValue(2);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.data).toHaveLength(1);
      expect(data.data.total).toBe(1);
      expect(data.data.originalTotal).toBe(2);
    });

    it('handles database errors gracefully', async () => {
      mockFindMany.mockRejectedValue(new Error('Database connection failed'));

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
    });

    it('returns empty list when no rate cards exist', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data).toEqual([]);
      expect(data.data.total).toBe(0);
    });

    it('filters by roleStandardized with insensitive contains', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?roleStandardized=Software');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roleStandardized: { contains: 'Software', mode: 'insensitive' },
          }),
        })
      );
    });

    it('filters by region', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?region=North%20America');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ region: 'North America' }),
        })
      );
    });

    it('filters by lineOfService', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?lineOfService=Technology');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ lineOfService: 'Technology' }),
        })
      );
    });

    it('filters by clientName with insensitive contains', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?clientName=Acme');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientName: { contains: 'Acme', mode: 'insensitive' },
          }),
        })
      );
    });

    it('uses default sort by createdAt desc', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('filters by supplierId', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rate-cards?supplierId=sup-1');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ supplierId: 'sup-1' }),
        })
      );
    });
  });

  describe('POST /api/rate-cards', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/rate-cards');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('creates a rate card entry successfully', async () => {
      const newEntry = {
        id: 'new-rate-1',
        tenantId: 'tenant-1',
        supplierName: 'Test Supplier',
        roleOriginal: 'Developer',
        dailyRate: 1000,
        createdBy: 'user-1',
        updatedBy: 'user-1',
      };
      mockCreate.mockResolvedValue(newEntry);

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/rate-cards', {
        body: {
          supplierName: 'Test Supplier',
          roleOriginal: 'Developer',
          dailyRate: 1000,
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.supplierName).toBe('Test Supplier');
    });

    it('sets tenantId and userId on created entry', async () => {
      mockCreate.mockResolvedValue({ id: 'new-1' });

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/rate-cards', {
        body: { supplierName: 'Test', dailyRate: 500 },
      });
      await POST(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            createdBy: 'user-1',
            updatedBy: 'user-1',
          }),
        })
      );
    });

    it('converts date strings to Date objects', async () => {
      mockCreate.mockResolvedValue({ id: 'new-1' });

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/rate-cards', {
        body: {
          supplierName: 'Test',
          effectiveDate: '2024-01-01',
          expiryDate: '2025-12-31',
        },
      });
      await POST(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            effectiveDate: expect.any(Date),
            expiryDate: expect.any(Date),
          }),
        })
      );
    });

    it('handles database errors in POST', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'));

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/rate-cards', {
        body: { supplierName: 'Test', dailyRate: 500 },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});
