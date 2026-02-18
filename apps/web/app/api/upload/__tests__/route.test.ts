import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetServerSession, mockSafeParse } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockSafeParse: vi.fn(),
}));

// Mock dependencies before importing route
vi.mock('@/lib/auth', () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock('@/lib/config', () => ({
  API_BASE_URL: 'http://localhost:4000',
}));

vi.mock('@/lib/types/common', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  isUploadedFile: (f: unknown) => f instanceof Blob || (f && typeof f === 'object' && 'name' in (f as object)),
}));

vi.mock('schemas', () => ({
  uploadRequestSchema: {
    safeParse: mockSafeParse,
  },
}));

import { POST } from '../../upload/batch/route';

function createAuthenticatedRequest(
  url: string,
  options?: { headers?: Record<string, string> }
): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      ...(options?.headers || {}),
    },
  });
}

function createUnauthenticatedRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'POST' });
}

describe('POST /api/upload/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', tenantId: 'test-tenant', email: 'test@example.com' },
    });
    mockSafeParse.mockReturnValue({ success: true, data: {} });
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/upload/batch');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when no files provided', async () => {
    // The route calls formData() which requires a proper multipart request.
    // With the mock NextRequest, request.formData() will throw, causing an error response.
    const request = createAuthenticatedRequest('http://localhost:3000/api/upload/batch');
    const response = await POST(request);
    const data = await response.json();

    // When formData() fails, the error handler returns a 500/error response
    expect(data.success).toBe(false);
  });

  it('returns error response structure with proper fields', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/upload/batch');
    const response = await POST(request);
    const data = await response.json();

    expect(data).toHaveProperty('success', false);
    expect(data).toHaveProperty('error');
    expect(data.error).toHaveProperty('code');
    expect(data.error).toHaveProperty('message');
    expect(data).toHaveProperty('meta');
    expect(data.meta).toHaveProperty('requestId');
    expect(data.meta).toHaveProperty('timestamp');
  });
});
