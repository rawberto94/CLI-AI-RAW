import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany, mockCreate } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clauseLibrary: {
      findMany: mockFindMany,
      create: mockCreate,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { GET, POST } from '../route';

function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: { body?: object; searchParams?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url);
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
  }
  return new NextRequest(fullUrl.toString(), {
    method,
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

function createUnauthenticatedRequest(method: string, url: string): NextRequest {
  return new NextRequest(url, { method });
}

describe('GET /api/clauses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/clauses');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns clauses list', async () => {
    const now = new Date();
    mockFindMany.mockResolvedValue([
      {
        id: 'clause-1',
        title: 'NDA Clause',
        content: 'This is a {{party_name}} NDA clause.',
        category: 'NDA',
        tags: ['nda', 'confidentiality'],
        riskLevel: 'LOW',
        isStandard: true,
        usageCount: 5,
        alternativeText: 'Alt text',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/clauses');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.clauses).toHaveLength(1);
    expect(data.data.clauses[0].title).toBe('NDA Clause');
    expect(data.data.clauses[0].riskLevel).toBe('low');
    expect(data.data.clauses[0].variables).toEqual(['party_name']);
    expect(data.data.total).toBe(1);
    expect(data.data.source).toBe('database');
  });

  it('filters by category', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/clauses', {
      searchParams: { category: 'NDA' },
    });
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'NDA' }),
      })
    );
  });

  it('filters by search term', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/clauses', {
      searchParams: { search: 'confidential' },
    });
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ title: { contains: 'confidential', mode: 'insensitive' } }),
          ]),
        }),
      })
    );
  });

  it('returns empty array when no clauses found', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/clauses');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.clauses).toEqual([]);
    expect(data.data.total).toBe(0);
  });
});

describe('POST /api/clauses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/clauses');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('creates a new clause', async () => {
    const now = new Date();
    mockCreate.mockResolvedValue({
      id: 'new-clause-1',
      title: 'Indemnity Clause',
      content: 'Indemnity content for {{company}}',
      category: 'INDEMNITY',
      tags: ['legal'],
      riskLevel: 'HIGH',
      isStandard: false,
      usageCount: 0,
      alternativeText: null,
      createdAt: now,
      updatedAt: now,
    });

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/clauses', {
      body: {
        title: 'Indemnity Clause',
        content: 'Indemnity content for {{company}}',
        category: 'indemnity',
        tags: ['legal'],
        riskLevel: 'HIGH',
      },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.clause.title).toBe('Indemnity Clause');
    expect(data.data.clause.variables).toEqual(['company']);
    expect(data.data.source).toBe('database');
  });

  it('returns 400 when required fields missing', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/clauses', {
      body: { title: 'Missing fields' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });
});
