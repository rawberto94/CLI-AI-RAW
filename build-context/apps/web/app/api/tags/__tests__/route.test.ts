import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findMany: vi.fn(),
    },
    tenantSettings: {
      findFirst: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
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
  url: string = 'http://localhost:3000/api/tags',
  body?: Record<string, unknown>
): NextRequest {
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url), options);
}

describe('GET /api/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Tenant ID is required');
  });

  it('should return aggregated tags from contracts successfully', async () => {
    const mockContracts = [
      {
        id: 'c1',
        tags: ['Legal', 'Urgent'],
        tagColors: { Legal: '#FF0000', Urgent: '#FFFF00' },
        tagDescriptions: { Legal: 'Legal matters' },
      },
      {
        id: 'c2',
        tags: ['Legal', 'Finance'],
        tagColors: { Legal: '#FF0000', Finance: '#00FF00' },
        tagDescriptions: {},
      },
    ];

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.tenantSettings.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.contract.findMany).mockResolvedValue(mockContracts);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tags).toBeDefined();
    expect(data.data.summary).toBeDefined();
  });

  it('should include predefined tags from tenant settings', async () => {
    const mockSettings = {
      id: 'settings1',
      tenantId: 'tenant1',
      predefinedTags: [
        { name: 'Compliance', color: '#0000FF', description: 'Compliance related' },
      ],
    };

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.tenantSettings.findFirst).mockResolvedValue(mockSettings);
    vi.mocked(prisma.contract.findMany).mockResolvedValue([]);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should sort tags by name by default', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.tenantSettings.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.contract.findMany).mockResolvedValue([
      { id: 'c1', tags: ['Zebra', 'Alpha', 'Beta'], tagColors: {}, tagDescriptions: {} },
    ]);

    const request = createRequest('GET', 'http://localhost:3000/api/tags?sortBy=name');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Tags should be sorted alphabetically
    const tagNames = data.data.tags.map((t: { name: string }) => t.name);
    expect(tagNames).toEqual(['Alpha', 'Beta', 'Zebra']);
  });

  it('should respect limit parameter', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.tenantSettings.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.contract.findMany).mockResolvedValue([
      { id: 'c1', tags: ['Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5'], tagColors: {}, tagDescriptions: {} },
    ]);

    const request = createRequest('GET', 'http://localhost:3000/api/tags?limit=3');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tags.length).toBeLessThanOrEqual(3);
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.tenantSettings.findFirst).mockRejectedValue(new Error('Database error'));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch tags');
  });
});

describe('POST /api/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest('POST', 'http://localhost:3000/api/tags', { name: 'Test Tag' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Tenant ID is required');
  });

  it('should return 400 when tag name is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');

    const request = createRequest('POST', 'http://localhost:3000/api/tags', {});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('name');
  });

  it('should create a new tag successfully', async () => {
    const mockTag = {
      id: 'tag1',
      name: 'New Tag',
      color: '#FF0000',
      description: 'A new tag',
      tenantId: 'tenant1',
      createdAt: new Date(),
    };

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.tag.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tag.create).mockResolvedValue(mockTag);

    const request = createRequest('POST', 'http://localhost:3000/api/tags', {
      name: 'New Tag',
      color: '#FF0000',
      description: 'A new tag',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tag.name).toBe('New Tag');
  });

  it('should handle duplicate tag names', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.tag.findFirst).mockResolvedValue({
      id: 'existing',
      name: 'Existing Tag',
      tenantId: 'tenant1',
    });

    const request = createRequest('POST', 'http://localhost:3000/api/tags', {
      name: 'Existing Tag',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('already exists');
  });
});
