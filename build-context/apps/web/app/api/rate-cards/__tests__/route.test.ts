/**
 * Unit Tests for Rate Cards API
 * Tests /api/rate-cards endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma - hoisted mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateCardEntry: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock auth - hoisted mock
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

// Import after mocking
import { GET, POST } from '@/app/api/rate-cards/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';

// Get mocked modules
const mockPrisma = vi.mocked(prisma);
const mockGetServerSession = vi.mocked(getServerSession);

// Helper to create mock request
function createRequest(url: string, options: RequestInit = {}) {
  return new NextRequest(`http://localhost${url}`, options);
}

describe('Rate Cards API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default session setup
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', tenantId: 'tenant_demo_001', role: 'admin' }
    });
  });

  describe('GET /api/rate-cards', () => {
    const mockRateCards = [
      {
        id: 'rate-1',
        tenantId: 'tenant_demo_001',
        contractId: 'contract-1',
        supplierId: 'supplier-1',
        supplierName: 'Accenture',
        roleOriginal: 'Senior Software Engineer',
        roleStandardized: 'Software Engineer',
        seniority: 'SENIOR',
        lineOfService: 'Technology',
        country: 'United States',
        region: 'North America',
        dailyRate: 1200.00,
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
        contract: {
          id: 'contract-1',
          fileName: 'accenture-rates.pdf',
          clientName: 'Acme Corp',
        },
      },
      {
        id: 'rate-2',
        tenantId: 'tenant_demo_001',
        contractId: 'contract-1',
        supplierId: 'supplier-1',
        supplierName: 'Accenture',
        roleOriginal: 'Principal Architect',
        roleStandardized: 'Solution Architect',
        seniority: 'PRINCIPAL',
        lineOfService: 'Technology',
        country: 'United States',
        region: 'North America',
        dailyRate: 1800.00,
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
        contract: {
          id: 'contract-1',
          fileName: 'accenture-rates.pdf',
          clientName: 'Acme Corp',
        },
      },
      {
        id: 'rate-3',
        tenantId: 'tenant_demo_001',
        contractId: 'contract-2',
        supplierId: 'supplier-2',
        supplierName: 'Deloitte',
        roleOriginal: 'Data Scientist',
        roleStandardized: 'Data Scientist',
        seniority: 'SENIOR',
        lineOfService: 'Data & Analytics',
        country: 'United States',
        region: 'North America',
        dailyRate: 1400.00,
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
        contract: {
          id: 'contract-2',
          fileName: 'deloitte-rates.pdf',
          clientName: 'Widget Co',
        },
      },
    ];

    it('should return rate cards for authenticated tenant', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue(mockRateCards);
      mockPrisma.rateCardEntry.count.mockResolvedValue(3);

      const request = createRequest('/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data).toHaveLength(3);
      expect(data.total).toBe(3);
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(50);
    });

    it('should return mock data when x-data-mode is mock', async () => {
      const request = createRequest('/api/rate-cards', {
        headers: { 'x-data-mode': 'mock' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data[0]).toHaveProperty('supplierName');
      expect(data.data[0]).toHaveProperty('dailyRate');
      // Should not call database
      expect(mockPrisma.rateCardEntry.findMany).not.toHaveBeenCalled();
    });

    it('should handle pagination', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(100);

      const request = createRequest('/api/rate-cards?page=2&pageSize=25');
      const response = await GET(request);
      const data = await response.json();

      expect(data.page).toBe(2);
      expect(data.pageSize).toBe(25);
      expect(data.totalPages).toBe(4);
      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        })
      );
    });

    it('should require tenant ID', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createRequest('/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Tenant ID is required');
    });

    it('should accept tenant ID from header', async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(1);

      const request = createRequest('/api/rate-cards', {
        headers: { 'x-tenant-id': 'tenant_demo_001' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.data).toHaveLength(1);
    });

    it('should filter by supplier name', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0], mockRateCards[1]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(2);

      const request = createRequest('/api/rate-cards?supplierName=Accenture');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            supplierName: { contains: 'Accenture', mode: 'insensitive' },
          }),
        })
      );
    });

    it('should filter by seniority level', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0], mockRateCards[2]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(2);

      const request = createRequest('/api/rate-cards?seniority=SENIOR');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            seniority: 'SENIOR',
          }),
        })
      );
    });

    it('should filter by country', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue(mockRateCards);
      mockPrisma.rateCardEntry.count.mockResolvedValue(3);

      const request = createRequest('/api/rate-cards?country=United%20States');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country: 'United States',
          }),
        })
      );
    });

    it('should filter by line of service', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[2]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(1);

      const request = createRequest('/api/rate-cards?lineOfService=Data%20%26%20Analytics');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lineOfService: 'Data & Analytics',
          }),
        })
      );
    });

    it('should filter by rate range', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(1);

      const request = createRequest('/api/rate-cards?minRate=1000&maxRate=1500');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dailyRate: { gte: 1000, lte: 1500 },
          }),
        })
      );
    });

    it('should filter by isBaseline', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0], mockRateCards[1]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(2);

      const request = createRequest('/api/rate-cards?isBaseline=true');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isBaseline: true,
          }),
        })
      );
    });

    it('should filter by isNegotiated', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0], mockRateCards[2]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(2);

      const request = createRequest('/api/rate-cards?isNegotiated=true');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isNegotiated: true,
          }),
        })
      );
    });

    it('should filter by effective date range', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue(mockRateCards);
      mockPrisma.rateCardEntry.count.mockResolvedValue(3);

      const request = createRequest('/api/rate-cards?effectiveDateFrom=2024-01-01&effectiveDateTo=2024-12-31');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });

    it('should filter by role standardized', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(1);

      const request = createRequest('/api/rate-cards?roleStandardized=Software%20Engineer');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roleStandardized: { contains: 'Software Engineer', mode: 'insensitive' },
          }),
        })
      );
    });

    it('should filter by contract ID', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0], mockRateCards[1]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(2);

      const request = createRequest('/api/rate-cards?contractId=contract-1');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contractId: 'contract-1',
          }),
        })
      );
    });

    it('should support sorting', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue(mockRateCards);
      mockPrisma.rateCardEntry.count.mockResolvedValue(3);

      const request = createRequest('/api/rate-cards?sortBy=dailyRate&sortOrder=asc');
      const response = await GET(request);
      await response.json();

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { dailyRate: 'asc' },
        })
      );
    });

    it('should deduplicate rate cards', async () => {
      // Create duplicate entries
      const duplicateRates = [
        mockRateCards[0],
        { ...mockRateCards[0], id: 'rate-1-dup' }, // Same role/seniority/rate/supplier
      ];
      mockPrisma.rateCardEntry.findMany.mockResolvedValue(duplicateRates);
      mockPrisma.rateCardEntry.count.mockResolvedValue(2);

      const request = createRequest('/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      // Should deduplicate to 1
      expect(data.data).toHaveLength(1);
      expect(data.originalTotal).toBe(2);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.rateCardEntry.findMany.mockRejectedValue(new Error('Database connection failed'));

      const request = createRequest('/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to list rate cards');
    });

    it('should include contract relationship in response', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([mockRateCards[0]]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(1);

      const request = createRequest('/api/rate-cards');
      const _response = await GET(request);

      expect(mockPrisma.rateCardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            contract: expect.any(Object),
          }),
        })
      );
    });

    it('should handle empty results', async () => {
      mockPrisma.rateCardEntry.findMany.mockResolvedValue([]);
      mockPrisma.rateCardEntry.count.mockResolvedValue(0);

      const request = createRequest('/api/rate-cards');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data).toHaveLength(0);
      expect(data.total).toBe(0);
    });

    it('should handle mock data pagination', async () => {
      const request = createRequest('/api/rate-cards?page=2&pageSize=3', {
        headers: { 'x-data-mode': 'mock' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.page).toBe(2);
      expect(data.pageSize).toBe(3);
    });
  });

  describe('POST /api/rate-cards', () => {
    const validRateCardData = {
      roleOriginal: 'Senior Developer',
      roleStandardized: 'Software Engineer',
      seniority: 'SENIOR',
      lineOfService: 'Technology',
      country: 'United States',
      region: 'North America',
      dailyRate: 1100.00,
      currency: 'USD',
      supplierId: 'supplier-1',
      supplierName: 'Tech Partners',
      effectiveDate: '2024-01-01',
      expiryDate: '2025-12-31',
      isBaseline: true,
      isNegotiated: false,
    };

    it('should create a new rate card entry', async () => {
      const createdEntry = {
        id: 'new-rate-1',
        tenantId: 'tenant_demo_001',
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...validRateCardData,
        effectiveDate: new Date(validRateCardData.effectiveDate),
        expiryDate: new Date(validRateCardData.expiryDate),
      };

      mockPrisma.rateCardEntry.create.mockResolvedValue(createdEntry);

      const request = createRequest('/api/rate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRateCardData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('new-rate-1');
      expect(data.tenantId).toBe('tenant_demo_001');
    });

    it('should require tenant ID for creation', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createRequest('/api/rate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRateCardData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Tenant ID is required');
    });

    it('should accept tenant ID from header for creation', async () => {
      mockGetServerSession.mockResolvedValue(null);
      
      const createdEntry = {
        id: 'new-rate-2',
        tenantId: 'tenant_demo_001',
        createdBy: 'system',
        updatedBy: 'system',
        ...validRateCardData,
        effectiveDate: new Date(validRateCardData.effectiveDate),
        expiryDate: new Date(validRateCardData.expiryDate),
      };
      mockPrisma.rateCardEntry.create.mockResolvedValue(createdEntry);

      const request = createRequest('/api/rate-cards', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant_demo_001',
        },
        body: JSON.stringify(validRateCardData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.tenantId).toBe('tenant_demo_001');
    });

    it('should convert date strings to Date objects', async () => {
      const createdEntry = {
        id: 'new-rate-3',
        tenantId: 'tenant_demo_001',
        createdBy: 'user-1',
        updatedBy: 'user-1',
        ...validRateCardData,
        effectiveDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-12-31'),
      };
      mockPrisma.rateCardEntry.create.mockResolvedValue(createdEntry);

      const request = createRequest('/api/rate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRateCardData),
      });
      await POST(request);

      expect(mockPrisma.rateCardEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            effectiveDate: expect.any(Date),
            expiryDate: expect.any(Date),
          }),
        })
      );
    });

    it('should handle creation errors', async () => {
      mockPrisma.rateCardEntry.create.mockRejectedValue(new Error('Unique constraint violation'));

      const request = createRequest('/api/rate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRateCardData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Failed to create rate card');
      expect(data.details).toContain('Unique constraint violation');
    });

    it('should set createdBy and updatedBy from session user', async () => {
      const createdEntry = {
        id: 'new-rate-4',
        tenantId: 'tenant_demo_001',
        createdBy: 'user-1',
        updatedBy: 'user-1',
        ...validRateCardData,
        effectiveDate: new Date(validRateCardData.effectiveDate),
        expiryDate: new Date(validRateCardData.expiryDate),
      };
      mockPrisma.rateCardEntry.create.mockResolvedValue(createdEntry);

      const request = createRequest('/api/rate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRateCardData),
      });
      await POST(request);

      expect(mockPrisma.rateCardEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            updatedBy: 'user-1',
          }),
        })
      );
    });

    it('should handle invalid JSON in request body', async () => {
      const request = createRequest('/api/rate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Failed to create rate card');
    });
  });
});
