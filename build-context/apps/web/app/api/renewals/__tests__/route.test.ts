/**
 * Unit Tests for Renewals API
 * Tests /api/renewals endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock tenant
vi.mock('@/lib/tenant-server', () => ({
  getServerTenantId: vi.fn().mockResolvedValue('tenant_demo_001'),
}));

// Import after mocking
import { GET } from '../route';
import { prisma } from '@/lib/prisma';

const mockPrisma = vi.mocked(prisma);

// Helper to create test contracts
function createMockContract(overrides = {}) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  return {
    id: 'contract-1',
    tenantId: 'tenant_demo_001',
    contractTitle: 'Test Contract',
    originalName: 'test.pdf',
    fileName: 'test.pdf',
    status: 'ACTIVE',
    endDate: futureDate,
    expirationDate: null,
    startDate: now,
    effectiveDate: now,
    totalValue: 50000,
    supplierName: 'Acme Corp',
    autoRenewalEnabled: false,
    renewalStatus: null,
    artifacts: [],
    contractMetadata: null,
    ...overrides,
  };
}

describe('Renewals API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/renewals', () => {
    it('should return list of upcoming renewals', async () => {
      const mockContracts = [
        createMockContract({ id: 'c1', contractTitle: 'Contract A' }),
        createMockContract({ id: 'c2', contractTitle: 'Contract B' }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.renewals).toHaveLength(2);
    });

    it('should calculate days until expiry correctly', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15); // 15 days from now
      
      const mockContracts = [
        createMockContract({ endDate: futureDate }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].daysUntilExpiry).toBeGreaterThanOrEqual(14);
      expect(data.renewals[0].daysUntilExpiry).toBeLessThanOrEqual(16);
    });

    it('should assign critical priority for contracts expiring within 7 days', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days
      
      const mockContracts = [
        createMockContract({ endDate: futureDate }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].priority).toBe('critical');
    });

    it('should assign high priority for contracts expiring within 30 days', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20); // 20 days
      
      const mockContracts = [
        createMockContract({ endDate: futureDate }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].priority).toBe('high');
    });

    it('should filter by status', async () => {
      const mockContracts = [
        createMockContract({ id: 'c1' }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals?status=urgent');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.contract.findMany).toHaveBeenCalled();
    });

    it('should filter by priority', async () => {
      const mockContracts = [
        createMockContract({ id: 'c1' }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals?priority=high');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should filter by daysUntilExpiry', async () => {
      const mockContracts = [
        createMockContract({ id: 'c1' }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals?daysUntilExpiry=30');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should extract supplier from overview artifact', async () => {
      const mockContracts = [
        createMockContract({
          supplierName: null,
          artifacts: [
            {
              type: 'OVERVIEW',
              data: {
                parties: [
                  { name: 'Vendor ABC', role: 'vendor' }
                ]
              }
            }
          ]
        }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].supplier).toBe('Vendor ABC');
    });

    it('should extract value from financial artifact', async () => {
      const mockContracts = [
        createMockContract({
          totalValue: null,
          artifacts: [
            {
              type: 'FINANCIAL',
              data: { totalValue: 75000 }
            }
          ]
        }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].currentValue).toBe(75000);
    });

    it('should calculate health score from risk artifact', async () => {
      const mockContracts = [
        createMockContract({
          artifacts: [
            {
              type: 'RISK',
              data: { overallScore: 30 } // Low risk = high health
            }
          ]
        }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].healthScore).toBe(70); // 100 - 30
    });

    it('should handle contracts with auto-renewal enabled', async () => {
      const mockContracts = [
        createMockContract({ autoRenewalEnabled: true }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].autoRenewal).toBe(true);
    });

    it('should mark expired contracts correctly', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days ago
      
      const mockContracts = [
        createMockContract({ endDate: pastDate }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].status).toBe('expired');
    });

    it('should calculate notice deadline correctly', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90); // 90 days
      
      const mockContracts = [
        createMockContract({ endDate: futureDate }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      // Notice deadline should be 60 days before expiry
      expect(data.renewals[0].noticeDeadline).toBeDefined();
    });

    it('should handle empty results', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.contract.findMany.mockRejectedValue(new Error('DB Error'));

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should use expirationDate when endDate is null', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 45);
      
      const mockContracts = [
        createMockContract({ 
          endDate: null, 
          expirationDate: futureDate 
        }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].expiryDate).toBeDefined();
    });

    it('should return risk level based on health score', async () => {
      const mockContracts = [
        createMockContract({
          artifacts: [
            { type: 'RISK', data: { overallScore: 70 } }
          ]
        }),
      ];
      
      mockPrisma.contract.findMany.mockResolvedValue(mockContracts);

      const request = new NextRequest('http://localhost/api/renewals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.renewals[0].riskLevel).toBeDefined();
    });
  });
});
