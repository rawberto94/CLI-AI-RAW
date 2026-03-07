/**
 * Unit Tests for Signatures API
 * Tests /api/signatures endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma with signatureRequest model
const mockSignatureRequest = {
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    signatureRequest: mockSignatureRequest,
  },
}));

// Import after mocking
import { GET, POST } from '../route';

describe('Signatures API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/signatures', () => {
    it('should return list of signature requests', async () => {
      const mockRequests = [
        {
          id: 'sig-1',
          contractId: 'contract-1',
          status: 'pending',
          message: 'Please sign',
          createdAt: new Date(),
          signers: [
            { id: 's1', name: 'John', email: 'john@example.com', role: 'signer', order: 1, status: 'pending' }
          ],
          contract: { id: 'contract-1', filename: 'test.pdf' }
        }
      ];
      
      mockSignatureRequest.findMany.mockResolvedValue(mockRequests);
      mockSignatureRequest.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost/api/signatures');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(1);
    });

    it('should filter by contractId', async () => {
      mockSignatureRequest.findMany.mockResolvedValue([]);
      mockSignatureRequest.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost/api/signatures?contractId=contract-1');
      await GET(request);

      expect(mockSignatureRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contractId: 'contract-1' })
        })
      );
    });

    it('should filter by status', async () => {
      mockSignatureRequest.findMany.mockResolvedValue([]);
      mockSignatureRequest.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost/api/signatures?status=pending');
      await GET(request);

      expect(mockSignatureRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' })
        })
      );
    });

    it('should handle pagination', async () => {
      mockSignatureRequest.findMany.mockResolvedValue([]);
      mockSignatureRequest.count.mockResolvedValue(25);

      const request = new NextRequest('http://localhost/api/signatures?page=2&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.pagination.page).toBe(2);
      expect(data.data.pagination.limit).toBe(10);
      expect(data.data.pagination.totalPages).toBe(3);
    });

    it('should fallback to mock data when table does not exist', async () => {
      mockSignatureRequest.findMany.mockRejectedValue(new Error('Table not found'));

      const request = new NextRequest('http://localhost/api/signatures?contractId=contract-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.source).toBe('mock');
    });

    it('should return empty mock data when no contractId provided', async () => {
      mockSignatureRequest.findMany.mockRejectedValue(new Error('Table not found'));

      const request = new NextRequest('http://localhost/api/signatures');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.items).toEqual([]);
    });

    it('should include signers in response', async () => {
      const mockRequests = [
        {
          id: 'sig-1',
          contractId: 'contract-1',
          status: 'pending',
          signers: [
            { id: 's1', name: 'John', email: 'john@example.com', role: 'signer', order: 1, status: 'pending' },
            { id: 's2', name: 'Jane', email: 'jane@example.com', role: 'approver', order: 2, status: 'pending' }
          ]
        }
      ];
      
      mockSignatureRequest.findMany.mockResolvedValue(mockRequests);
      mockSignatureRequest.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost/api/signatures');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.items[0].signers).toHaveLength(2);
    });

    it('should handle general errors', async () => {
      // Mock URL parsing to fail
      const request = {
        url: null,
      } as unknown as NextRequest;

      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/signatures', () => {
    it('should create a new signature request', async () => {
      const newRequest = {
        id: 'sig-new',
        contractId: 'contract-1',
        status: 'pending',
        message: 'Please sign',
        signers: [
          { id: 's1', name: 'John', email: 'john@example.com', role: 'signer', order: 1, status: 'pending' }
        ]
      };
      
      mockSignatureRequest.create.mockResolvedValue(newRequest);

      const request = new NextRequest('http://localhost/api/signatures', {
        method: 'POST',
        body: JSON.stringify({
          contractId: 'contract-1',
          signers: [
            { name: 'John', email: 'john@example.com', role: 'signer', order: 1 }
          ]
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it('should require contractId', async () => {
      const request = new NextRequest('http://localhost/api/signatures', {
        method: 'POST',
        body: JSON.stringify({
          signers: [{ name: 'John', email: 'john@example.com' }]
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Contract ID');
    });

    it('should require at least one signer', async () => {
      const request = new NextRequest('http://localhost/api/signatures', {
        method: 'POST',
        body: JSON.stringify({
          contractId: 'contract-1',
          signers: []
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('signer');
    });

    it('should validate signer has name and email', async () => {
      const request = new NextRequest('http://localhost/api/signatures', {
        method: 'POST',
        body: JSON.stringify({
          contractId: 'contract-1',
          signers: [{ name: 'John' }] // Missing email
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('name and email');
    });

    it('should accept custom message', async () => {
      mockSignatureRequest.create.mockResolvedValue({
        id: 'sig-new',
        message: 'Custom message'
      });

      const request = new NextRequest('http://localhost/api/signatures', {
        method: 'POST',
        body: JSON.stringify({
          contractId: 'contract-1',
          signers: [{ name: 'John', email: 'john@example.com', role: 'signer', order: 1 }],
          message: 'Custom message'
        })
      });

      await POST(request);

      expect(mockSignatureRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Custom message'
          })
        })
      );
    });

    it('should accept custom expiration date', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      mockSignatureRequest.create.mockResolvedValue({
        id: 'sig-new',
        expiresAt
      });

      const request = new NextRequest('http://localhost/api/signatures', {
        method: 'POST',
        body: JSON.stringify({
          contractId: 'contract-1',
          signers: [{ name: 'John', email: 'john@example.com', role: 'signer', order: 1 }],
          expiresAt
        })
      });

      await POST(request);

      expect(mockSignatureRequest.create).toHaveBeenCalled();
    });

    it('should fallback to mock when table does not exist', async () => {
      mockSignatureRequest.create.mockRejectedValue(new Error('Table not found'));

      const request = new NextRequest('http://localhost/api/signatures', {
        method: 'POST',
        body: JSON.stringify({
          contractId: 'contract-1',
          signers: [{ name: 'John', email: 'john@example.com', role: 'signer', order: 1 }]
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.source).toBe('mock');
    });

    it('should handle multiple signers', async () => {
      mockSignatureRequest.create.mockResolvedValue({
        id: 'sig-new',
        signers: [
          { name: 'John', email: 'john@example.com', order: 1 },
          { name: 'Jane', email: 'jane@example.com', order: 2 },
          { name: 'Bob', email: 'bob@example.com', order: 3 }
        ]
      });

      const request = new NextRequest('http://localhost/api/signatures', {
        method: 'POST',
        body: JSON.stringify({
          contractId: 'contract-1',
          signers: [
            { name: 'John', email: 'john@example.com', role: 'signer', order: 1 },
            { name: 'Jane', email: 'jane@example.com', role: 'approver', order: 2 },
            { name: 'Bob', email: 'bob@example.com', role: 'viewer', order: 3 }
          ]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });

    it('should handle invalid JSON gracefully', async () => {
      const request = new NextRequest('http://localhost/api/signatures', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });
});
