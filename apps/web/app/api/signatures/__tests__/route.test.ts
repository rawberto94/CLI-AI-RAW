import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockSrFindMany, mockSrCount, mockCreateEnvelope } = vi.hoisted(() => ({
  mockSrFindMany: vi.fn(),
  mockSrCount: vi.fn(),
  mockCreateEnvelope: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    signatureRequest: {
      findMany: mockSrFindMany,
      count: mockSrCount,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

vi.mock('@/lib/realtime/publish', () => ({
  publishRealtimeEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/esignature/docusign.service', () => ({
  eSignatureService: {
    createEnvelope: mockCreateEnvelope,
    isDocuSignConfigured: vi.fn().mockReturnValue(false),
  },
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

describe('GET /api/signatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/signatures');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns signature requests list', async () => {
    mockSrFindMany.mockResolvedValue([
      {
        id: 'sr-1',
        tenantId: 'test-tenant',
        contractId: 'c-1',
        status: 'pending',
        signers: [{ name: 'John', email: 'john@test.com', role: 'signer', order: 1 }],
        createdAt: new Date(),
        contract: { id: 'c-1', fileName: 'test.pdf', contractTitle: 'Test NDA', supplierName: 'Acme' },
      },
    ]);
    mockSrCount.mockResolvedValue(1);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/signatures');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.items).toHaveLength(1);
    expect(data.data.data.pagination.total).toBe(1);
  });

  it('filters by contractId', async () => {
    mockSrFindMany.mockResolvedValue([]);
    mockSrCount.mockResolvedValue(0);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/signatures', {
      searchParams: { contractId: 'c-1' },
    });
    await GET(request);

    expect(mockSrFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contractId: 'c-1' }),
      })
    );
  });

  it('returns empty list', async () => {
    mockSrFindMany.mockResolvedValue([]);
    mockSrCount.mockResolvedValue(0);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/signatures');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.items).toEqual([]);
  });
});

describe('POST /api/signatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/signatures');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('creates signature request', async () => {
    mockCreateEnvelope.mockResolvedValue({
      envelopeId: 'env-1',
      provider: 'manual',
      status: 'pending',
      externalEnvelopeId: null,
      signers: [{ name: 'Jane', email: 'jane@test.com' }],
    });

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/signatures', {
      body: {
        contractId: 'c-1',
        signers: [{ name: 'Jane', email: 'jane@test.com', role: 'signer', order: 1 }],
      },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.data.id).toBe('env-1');
    expect(data.data.data.provider).toBe('manual');
  });

  it('returns 400 when contractId missing', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/signatures', {
      body: { signers: [{ name: 'Jane', email: 'jane@test.com', role: 'signer', order: 1 }] },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when signers empty', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/signatures', {
      body: { contractId: 'c-1', signers: [] },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when signer missing email', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/signatures', {
      body: { contractId: 'c-1', signers: [{ name: 'Jane', role: 'signer', order: 1 }] },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });
});
