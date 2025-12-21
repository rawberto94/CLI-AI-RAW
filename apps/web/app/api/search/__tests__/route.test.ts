import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: vi.fn(),
    },
  },
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';

function createRequest(
  method: string = 'POST',
  url: string = 'http://localhost:3000/api/search',
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const options: RequestInit = { 
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-data-mode': 'real',
      ...(headers || {}),
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url), options);
}

describe('POST /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return mock data when data mode is not real', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/search'), {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
      headers: {
        'Content-Type': 'application/json',
        'x-data-mode': 'demo',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    // Mock should not call database
    expect(prisma.contract.findMany).not.toHaveBeenCalled();
  });

  it('should search contracts with query', async () => {
    const mockContracts = [
      {
        id: 'c1',
        contractTitle: 'Software License Agreement',
        description: 'License for software development',
        supplierName: 'TechCorp',
        clientName: 'ClientCo',
        status: 'ACTIVE',
        totalValue: 100000,
        uploadedAt: new Date(),
        artifacts: [],
      },
    ];

    vi.mocked(prisma.contract.findMany).mockResolvedValue(mockContracts);

    const request = createRequest('POST', 'http://localhost:3000/api/search', {
      query: 'software',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toBeDefined();
    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ contractTitle: { contains: 'software', mode: 'insensitive' } }),
          ]),
        }),
      })
    );
  });

  it('should filter by status when provided', async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValue([]);

    const request = createRequest('POST', 'http://localhost:3000/api/search', {
      query: 'test',
      filters: { status: 'active' },
    });

    await POST(request);

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
        }),
      })
    );
  });

  it('should filter by minValue when provided', async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValue([]);

    const request = createRequest('POST', 'http://localhost:3000/api/search', {
      query: 'test',
      filters: { minValue: 50000 },
    });

    await POST(request);

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          totalValue: expect.objectContaining({ gte: 50000 }),
        }),
      })
    );
  });

  it('should filter by maxValue when provided', async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValue([]);

    const request = createRequest('POST', 'http://localhost:3000/api/search', {
      query: 'test',
      filters: { maxValue: 100000 },
    });

    await POST(request);

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          totalValue: expect.objectContaining({ lte: 100000 }),
        }),
      })
    );
  });

  it('should filter by date range when provided', async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValue([]);

    const request = createRequest('POST', 'http://localhost:3000/api/search', {
      query: 'test',
      filters: { dateRange: '30d' },
    });

    await POST(request);

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          uploadedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
  });

  it('should format search results correctly', async () => {
    const mockContracts = [
      {
        id: 'c1',
        contractTitle: 'Test Contract',
        description: 'A test contract description',
        supplierName: 'Supplier Inc',
        clientName: 'Client Corp',
        status: 'ACTIVE',
        totalValue: 150000,
        currency: 'USD',
        uploadedAt: new Date('2024-01-15'),
        artifacts: [{ id: 'a1', type: 'PDF' }],
      },
    ];

    vi.mocked(prisma.contract.findMany).mockResolvedValue(mockContracts);

    const request = createRequest('POST', 'http://localhost:3000/api/search', {
      query: 'test',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.results).toHaveLength(1);
    expect(data.results[0].id).toBe('c1');
    expect(data.results[0].title).toBe('Test Contract');
    expect(data.results[0].type).toBe('contract');
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.contract.findMany).mockRejectedValue(new Error('Database error'));

    const request = createRequest('POST', 'http://localhost:3000/api/search', {
      query: 'test',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it('should limit results to 20 by default', async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValue([]);

    const request = createRequest('POST', 'http://localhost:3000/api/search', {
      query: 'test',
    });

    await POST(request);

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      })
    );
  });
});
