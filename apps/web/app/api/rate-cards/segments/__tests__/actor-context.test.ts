import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockListSegments,
  mockCreateSegment,
  mockUpdateSegment,
  mockShareSegmentCall,
} = vi.hoisted(() => ({
  mockListSegments: vi.fn(),
  mockCreateSegment: vi.fn(),
  mockUpdateSegment: vi.fn(),
  mockShareSegmentCall: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('data-orchestration/services', () => ({
  segmentManagementService: class {
    listSegments = mockListSegments;
    createSegment = mockCreateSegment;
    updateSegment = mockUpdateSegment;
    shareSegment = mockShareSegmentCall;
  },
}));

import { GET as getSegments, POST as postSegments } from '../route';
import { PATCH as patchSegment } from '../[id]/route';
import { POST as postSegmentShare } from '../[id]/share/route';

function createRequest(
  url: string,
  method: 'GET' | 'POST' | 'PATCH',
  withAuth = true,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('rate-card segment actor context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated segment listing', async () => {
    const response = await getSegments(createRequest('/api/rate-cards/segments', 'GET', false));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('lists segments using the authenticated user id', async () => {
    mockListSegments.mockResolvedValue({ segments: [], total: 0 });

    const response = await getSegments(
      createRequest('/api/rate-cards/segments?includeShared=true', 'GET'),
    );

    expect(response.status).toBe(200);
    expect(mockListSegments).toHaveBeenCalledWith('tenant-1', 'user-1', {
      includeShared: true,
      skip: undefined,
      take: undefined,
    });
  });

  it('creates segments using the authenticated user id', async () => {
    mockCreateSegment.mockResolvedValue({ id: 'seg-1' });

    const response = await postSegments(
      createRequest('/api/rate-cards/segments', 'POST', true, {
        name: 'My Segment',
        description: 'desc',
        filters: { rootGroup: { logic: 'AND', conditions: [] } },
        shared: false,
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateSegment).toHaveBeenCalledWith('tenant-1', 'user-1', {
      name: 'My Segment',
      description: 'desc',
      filters: { rootGroup: { logic: 'AND', conditions: [] } },
      shared: false,
    });
  });

  it('updates segments using the authenticated user id', async () => {
    mockUpdateSegment.mockResolvedValue({ id: 'seg-1' });

    const response = await patchSegment(
      createRequest('/api/rate-cards/segments/seg-1', 'PATCH', true, {
        name: 'Updated Segment',
      }),
      { params: Promise.resolve({ id: 'seg-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockUpdateSegment).toHaveBeenCalledWith('seg-1', 'tenant-1', 'user-1', {
      name: 'Updated Segment',
      description: undefined,
      filters: undefined,
      shared: undefined,
    });
  });

  it('shares segments using the authenticated user id', async () => {
    mockShareSegmentCall.mockResolvedValue({ id: 'seg-1', shared: true });

    const response = await postSegmentShare(
      createRequest('/api/rate-cards/segments/seg-1/share', 'POST', true, {}),
      { params: Promise.resolve({ id: 'seg-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockShareSegmentCall).toHaveBeenCalledWith('seg-1', 'tenant-1', 'user-1');
  });
});