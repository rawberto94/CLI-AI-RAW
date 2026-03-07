/**
 * Unit Tests for Contracts API
 * Tests /api/contracts endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock cache module
vi.mock('@/lib/cache', () => ({
  withCache: vi.fn((key, fn) => fn()),
  CacheKeys: {
    contractsList: vi.fn().mockReturnValue('contracts:list'),
  },
}));

// Mock tenant server - hoisted mock
vi.mock('@/lib/tenant-server', () => ({
  getTenantIdFromRequest: vi.fn(),
}));

// Mock Prisma - hoisted mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    taxonomyCategory: {
      findMany: vi.fn(),
    },
  },
}));

// Import after mocking
import { GET } from '@/app/api/contracts/route';
import { prisma } from '@/lib/prisma';
import { getTenantIdFromRequest } from '@/lib/tenant-server';

// Get mocked modules
const mockPrisma = vi.mocked(prisma);
const mockGetTenantId = vi.mocked(getTenantIdFromRequest);

// Helper to create mock request
function createRequest(url: string, options: RequestInit = {}) {
  return new NextRequest(`http://localhost${url}`, options);
}

describe('Contracts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default tenant setup
    mockGetTenantId.mockResolvedValue('tenant_demo_001');
  });

  describe('GET /api/contracts', () => {
    const mockContracts = [
      {
        id: 'contract-1',
        tenantId: 'tenant_demo_001',
        fileName: 'contract-1.pdf',
        originalName: 'IT Services Agreement',
        fileSize: BigInt(125000),
        mimeType: 'application/pdf',
        createdAt: new Date('2024-01-15'),
        uploadedAt: new Date('2024-01-15'),
        status: 'COMPLETED',
        contractType: 'IT Services',
        contractTitle: 'IT Services Agreement',
        clientName: 'Acme Corp',
        supplierName: 'Tech Partners Inc',
        category: 'Technology',
        totalValue: BigInt(500000),
        currency: 'USD',
        effectiveDate: new Date('2024-01-01'),
        expirationDate: new Date('2025-12-31'),
        description: 'Annual IT services contract',
        tags: ['IT', 'services'],
        viewCount: 10,
        lastViewedAt: new Date('2024-12-01'),
        jurisdiction: 'USA',
        paymentTerms: 'Net 30',
        paymentFrequency: 'Monthly',
        aiMetadata: null,
        parentContractId: null,
        relationshipType: null,
        parentContract: null,
        _count: { childContracts: 0 },
      },
      {
        id: 'contract-2',
        tenantId: 'tenant_demo_001',
        fileName: 'contract-2.pdf',
        originalName: 'Software License Agreement',
        fileSize: BigInt(85000),
        mimeType: 'application/pdf',
        createdAt: new Date('2024-02-01'),
        uploadedAt: new Date('2024-02-01'),
        status: 'PROCESSING',
        contractType: 'Software License',
        contractTitle: 'Enterprise License',
        clientName: 'Widget Co',
        supplierName: 'Software Corp',
        category: 'Software',
        totalValue: BigInt(250000),
        currency: 'USD',
        effectiveDate: new Date('2024-02-01'),
        expirationDate: new Date('2025-01-31'),
        description: 'Enterprise software license',
        tags: ['software', 'license'],
        viewCount: 5,
        lastViewedAt: new Date('2024-11-15'),
        jurisdiction: 'USA',
        paymentTerms: 'Annual',
        paymentFrequency: 'Yearly',
        aiMetadata: null,
        parentContractId: null,
        relationshipType: null,
        parentContract: null,
        _count: { childContracts: 2 },
      },
    ];

    it('should return list of contracts with default pagination', async () => {
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);
      mockPrisma.contract.count.mockResolvedValue(2);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.contracts).toHaveLength(2);
      expect(data.data.pagination.total).toBe(2);
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.limit).toBe(20);
    });

    it('should return contracts with proper field mapping', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts');
      const response = await GET(request);
      const data = await response.json();

      const contract = data.data.contracts[0];
      expect(contract.id).toBe('contract-1');
      expect(contract.title).toBe('IT Services Agreement');
      expect(contract.status).toBe('completed');
      expect(contract.parties.client).toBe('Acme Corp');
      expect(contract.parties.supplier).toBe('Tech Partners Inc');
      expect(contract.contractType).toBe('IT Services');
    });

    it('should handle pagination parameters', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[1]]);
      mockPrisma.contract.count.mockResolvedValue(50);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?page=2&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.pagination.page).toBe(2);
      expect(data.data.pagination.limit).toBe(10);
      expect(data.data.pagination.totalPages).toBe(5);
      expect(data.data.pagination.hasMore).toBe(true);
      expect(data.data.pagination.hasPrevious).toBe(true);
    });

    it('should validate page must be greater than 0', async () => {
      const request = createRequest('/api/contracts?page=0');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Page must be greater than 0');
    });

    it('should validate limit between 1 and 100', async () => {
      const request = createRequest('/api/contracts?limit=150');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Limit must be between 1 and 100');
    });

    it('should filter by status', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?status=COMPLETED');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.filters.applied.statuses).toContain('COMPLETED');
    });

    it('should filter by search term', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?search=Acme');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.filters.applied.search).toBe('Acme');
    });

    it('should support sorting by different fields', async () => {
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);
      mockPrisma.contract.count.mockResolvedValue(2);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?sortBy=totalValue&sortOrder=asc');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.filters.sortBy).toBe('totalValue');
      expect(data.data.filters.sortOrder).toBe('asc');
    });

    it('should filter by contract type', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?contractType=IT%20Services');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.filters.applied.contractTypes).toContain('IT Services');
    });

    it('should filter by value range', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?minValue=100000&maxValue=600000');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.filters.applied.valueRange).toEqual({ min: 100000, max: 600000 });
    });

    it('should return mock data when x-data-mode is mock', async () => {
      const request = createRequest('/api/contracts', {
        headers: { 'x-data-mode': 'mock' },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.meta.source).toBe('mock-data');
      expect(data.data.contracts.length).toBeGreaterThan(0);
      // Should not call database
      expect(mockPrisma.contract.findMany).not.toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.contracts).toHaveLength(0);
      expect(data.data.pagination.total).toBe(0);
    });

    it('should handle contracts with categories', async () => {
      const contractsWithCategory = [{
        ...mockContracts[0],
        category: 'Technology',
      }];
      const mockCategories = [{
        id: 'cat-1',
        name: 'Technology',
        color: '#0066CC',
        icon: 'laptop',
        path: '/technology',
      }];

      mockPrisma.contract.findMany.mockResolvedValue(contractsWithCategory);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue(mockCategories);

      const request = createRequest('/api/contracts');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.contracts[0].category).toEqual({
        id: 'cat-1',
        name: 'Technology',
        color: '#0066CC',
        icon: 'laptop',
        path: '/technology',
      });
    });

    it('should handle contracts with hierarchy info', async () => {
      const contractWithHierarchy = {
        ...mockContracts[0],
        parentContractId: 'parent-1',
        relationshipType: 'amendment',
        parentContract: {
          id: 'parent-1',
          contractTitle: 'Master Agreement',
          fileName: 'master.pdf',
          contractType: 'MSA',
        },
        _count: { childContracts: 3 },
      };

      mockPrisma.contract.findMany.mockResolvedValue([contractWithHierarchy]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts');
      const response = await GET(request);
      const data = await response.json();

      const contract = data.data.contracts[0];
      expect(contract.parentContractId).toBe('parent-1');
      expect(contract.parentContract.title).toBe('Master Agreement');
      expect(contract.childContractCount).toBe(3);
      expect(contract.hasHierarchy).toBe(true);
    });

    it('should fallback to mock data on database error', async () => {
      mockPrisma.contract.findMany.mockRejectedValue(new Error('Database error'));

      const request = createRequest('/api/contracts');
      const response = await GET(request);
      const data = await response.json();

      // Should fallback to mock data
      expect(data.success).toBe(true);
      expect(data.data.meta.source).toBe('mock-data');
    });

    it('should include response time in metadata', async () => {
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);
      mockPrisma.contract.count.mockResolvedValue(2);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.meta.responseTime).toBeDefined();
      expect(response.headers.get('X-Response-Time')).toBeDefined();
    });

    it('should filter by expiration date range', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?expiringAfter=2024-01-01&expiringBefore=2025-12-31');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should filter by upload date range', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?uploadedAfter=2024-01-01&uploadedBefore=2024-12-31');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should filter by client name', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?clientName=Acme%20Corp');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.filters.applied.clientNames).toContain('Acme Corp');
    });

    it('should filter by supplier name', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrisma.contract.count.mockResolvedValue(1);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?supplierName=Tech%20Partners%20Inc');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.filters.applied.supplierNames).toContain('Tech Partners Inc');
    });

    it('should use default sort field for invalid sortBy', async () => {
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);
      mockPrisma.contract.count.mockResolvedValue(2);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?sortBy=invalidField');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.filters.sortBy).toBe('createdAt');
    });

    it('should handle multiple status filters', async () => {
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);
      mockPrisma.contract.count.mockResolvedValue(2);
      mockPrisma.taxonomyCategory.findMany.mockResolvedValue([]);

      const request = createRequest('/api/contracts?status=COMPLETED&status=PROCESSING');
      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.filters.applied.statuses).toContain('COMPLETED');
      expect(data.data.filters.applied.statuses).toContain('PROCESSING');
    });
  });
});
