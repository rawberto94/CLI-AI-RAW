import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockFetch,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-contract-sync',
    tenantId: 'tenant-1' as string | undefined,
    userId: 'user-1' as string | undefined,
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockFetch: vi.fn(),
}));

vi.mock('@/lib/api-middleware', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-middleware')>('@/lib/api-middleware');

  return {
    ...actual,
    withContractApiHandler: (handler: (request: NextRequest, context: any) => Promise<Response>) => {
      return (request: NextRequest) => handler(request, mockCtx);
    },
  };
});

import { GET, POST } from '../route';

describe('/api/contracts/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.tenantId = 'tenant-1';
    mockCtx.userId = 'user-1';
    vi.stubGlobal('fetch', mockFetch);
  });

  it('returns 401 before fan-out when userId is missing', async () => {
    mockCtx.userId = undefined;

    const response = await POST(
      new NextRequest('http://localhost:3000/api/contracts/sync', {
        method: 'POST',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('forwards authenticated headers to downstream sync endpoints', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { synced: 2 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { synced: 3 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { created: 1 } }), { status: 200 }));

    const response = await POST(
      new NextRequest('http://localhost:3000/api/contracts/sync', {
        method: 'POST',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.allSuccess).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/contracts/sync-expirations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-1',
          'x-user-id': 'user-1',
        }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/contracts/sync-health-scores',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-tenant-id': 'tenant-1',
          'x-user-id': 'user-1',
        }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/contracts/alerts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-tenant-id': 'tenant-1',
          'x-user-id': 'user-1',
        }),
        body: JSON.stringify({ tenantId: 'tenant-1', action: 'generate-pending' }),
      }),
    );
  });

  it('describes the downstream sync endpoints on GET', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/contracts/sync', {
        method: 'GET',
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.endpoints.healthScores).toBe('/api/contracts/sync-health-scores');
    expect(data.data.endpoints.fullSync).toBe('/api/contracts/sync (POST)');
  });
});