import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH, DELETE } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractTemplate: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: vi.fn(),
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/templates',
  body?: Record<string, unknown>
): NextRequest {
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url), options);
}

describe('GET /api/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return templates list successfully', async () => {
    const mockTemplates = [
      {
        id: 't1',
        name: 'NDA Template',
        description: 'Standard NDA template',
        category: 'LEGAL',
        tenantId: 'tenant1',
        isActive: true,
        usageCount: 5,
        createdAt: new Date(),
      },
    ];

    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValue(mockTemplates);
    vi.mocked(prisma.contractTemplate.count).mockResolvedValue(1);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.templates).toHaveLength(1);
    expect(data.templates[0].name).toBe('NDA Template');
    expect(data.total).toBe(1);
  });

  it('should filter templates by category', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contractTemplate.count).mockResolvedValue(0);

    const request = createRequest('GET', 'http://localhost:3000/api/templates?category=LEGAL');
    await GET(request);

    expect(prisma.contractTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'LEGAL' }),
      })
    );
  });

  it('should filter templates by search query', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contractTemplate.count).mockResolvedValue(0);

    const request = createRequest('GET', 'http://localhost:3000/api/templates?search=nda');
    await GET(request);

    expect(prisma.contractTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: { contains: 'nda', mode: 'insensitive' } }),
          ]),
        }),
      })
    );
  });

  it('should filter templates by isActive', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contractTemplate.count).mockResolvedValue(0);

    const request = createRequest('GET', 'http://localhost:3000/api/templates?isActive=true');
    await GET(request);

    expect(prisma.contractTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it('should handle pagination with limit and offset', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contractTemplate.count).mockResolvedValue(100);

    const request = createRequest('GET', 'http://localhost:3000/api/templates?limit=10&offset=20');
    const response = await GET(request);
    const data = await response.json();

    expect(prisma.contractTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
      })
    );
    expect(data.limit).toBe(10);
    expect(data.offset).toBe(20);
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.contractTemplate.findMany).mockRejectedValue(new Error('Database error'));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch templates');
  });
});

describe('POST /api/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when name is missing', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('POST', 'http://localhost:3000/api/templates', { clauses: [] });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('required');
  });

  it('should return 400 when clauses is missing', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('POST', 'http://localhost:3000/api/templates', { name: 'Test Template' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('required');
  });

  it('should create template successfully', async () => {
    const mockTemplate = {
      id: 't1',
      name: 'New Template',
      description: 'A test template',
      category: 'GENERAL',
      clauses: ['clause1', 'clause2'],
      tenantId: 'tenant1',
      createdAt: new Date(),
    };

    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.contractTemplate.create).mockResolvedValue(mockTemplate);

    const request = createRequest('POST', 'http://localhost:3000/api/templates', {
      name: 'New Template',
      description: 'A test template',
      clauses: ['clause1', 'clause2'],
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.template.name).toBe('New Template');
  });

  it('should create template with category', async () => {
    const mockTemplate = {
      id: 't1',
      name: 'Legal Template',
      category: 'LEGAL',
      clauses: [],
      tenantId: 'tenant1',
      createdAt: new Date(),
    };

    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.contractTemplate.create).mockResolvedValue(mockTemplate);

    const request = createRequest('POST', 'http://localhost:3000/api/templates', {
      name: 'Legal Template',
      category: 'LEGAL',
      clauses: [],
    });
    const response = await POST(request);

    expect(prisma.contractTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: 'LEGAL' }),
      })
    );
  });

  it('should handle creation errors gracefully', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');
    vi.mocked(prisma.contractTemplate.create).mockRejectedValue(new Error('Unique constraint violation'));

    const request = createRequest('POST', 'http://localhost:3000/api/templates', {
      name: 'Duplicate Template',
      clauses: [],
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });
});
