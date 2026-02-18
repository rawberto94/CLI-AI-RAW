/**
 * Unit Tests for Templates API
 * Tests /api/templates endpoint
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
    contractTemplate: {
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
    },
  },
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: vi.fn(),
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
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

describe('Templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/templates', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/templates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns templates list successfully', async () => {
      const mockTemplates = [
        {
          id: 't1',
          name: 'NDA Template',
          description: 'Standard NDA template',
          category: 'LEGAL',
          tenantId: 'tenant-1',
          isActive: true,
          usageCount: 5,
          clauses: [],
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-1',
        },
      ];
      mockFindMany.mockResolvedValue(mockTemplates);
      mockCount.mockResolvedValue(1);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/templates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.templates).toHaveLength(1);
      expect(data.data.templates[0].name).toBe('NDA Template');
      expect(data.data.total).toBe(1);
    });

    it('filters templates by category', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/templates?category=LEGAL');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'LEGAL' }),
        })
      );
    });

    it('filters templates by search query', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/templates?search=nda');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'nda', mode: 'insensitive' } }),
            ]),
          }),
        })
      );
    });

    it('filters templates by isActive', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/templates?isActive=true');
      await GET(request);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });

    it('handles pagination with limit and offset', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(100);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/templates?limit=10&offset=20');
      const response = await GET(request);
      const data = await response.json();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
      expect(data.data.limit).toBe(10);
      expect(data.data.offset).toBe(20);
    });

    it('handles database errors gracefully', async () => {
      mockFindMany.mockRejectedValue(new Error('Database error'));

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/templates');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('transforms template with metadata fields', async () => {
      const mockTemplates = [
        {
          id: 't1',
          name: 'Template',
          description: 'desc',
          category: 'GENERAL',
          isActive: true,
          clauses: [{ id: 'c1' }, { id: 'c2' }],
          metadata: { status: 'active', tags: ['legal'], content: 'template content', language: 'en-US', variables: [{ name: 'v1' }] },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-1',
          usageCount: 3,
        },
      ];
      mockFindMany.mockResolvedValue(mockTemplates);
      mockCount.mockResolvedValue(1);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/templates');
      const response = await GET(request);
      const data = await response.json();

      const template = data.data.templates[0];
      expect(template.status).toBe('active');
      expect(template.tags).toEqual(['legal']);
      expect(template.variables).toBe(1);
      expect(template.clauses).toBe(2);
    });
  });

  describe('POST /api/templates', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/templates');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('returns 400 when name is missing', async () => {
      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/templates', {
        body: { description: 'No name' },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Name is required');
    });

    it('creates template successfully', async () => {
      const mockTemplate = {
        id: 't1',
        name: 'New Template',
        description: 'A test template',
        category: 'GENERAL',
        clauses: [],
        metadata: { status: 'draft', content: '', tags: [] },
        tenantId: 'tenant-1',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        usageCount: 0,
      };
      mockCreate.mockResolvedValue(mockTemplate);

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/templates', {
        body: { name: 'New Template', description: 'A test template' },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.template.name).toBe('New Template');
    });

    it('sets tenantId and createdBy on created template', async () => {
      mockCreate.mockResolvedValue({
        id: 't1', name: 'Test', metadata: {}, clauses: [],
        createdAt: new Date(), updatedAt: new Date(), createdBy: 'user-1',
      });

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/templates', {
        body: { name: 'Test' },
      });
      await POST(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            createdBy: 'user-1',
          }),
        })
      );
    });
  });
});
