import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetMetrics, mockGetMetricsHistory, mockGetConnectionsByTenant,
  mockGetConnectionsByUser, mockFindStaleConnections, mockFindTimedOutConnections,
  mockCleanupConnections, mockGetConnection, mockUnregisterConnection,
  mockGetDegradationStatus, mockGetQueueStatus, mockBroadcast,
  mockBroadcastToTenant, mockBroadcastToUser,
} = vi.hoisted(() => ({
  mockGetMetrics: vi.fn(),
  mockGetMetricsHistory: vi.fn(),
  mockGetConnectionsByTenant: vi.fn(),
  mockGetConnectionsByUser: vi.fn(),
  mockFindStaleConnections: vi.fn(),
  mockFindTimedOutConnections: vi.fn(),
  mockCleanupConnections: vi.fn(),
  mockGetConnection: vi.fn(),
  mockUnregisterConnection: vi.fn(),
  mockGetDegradationStatus: vi.fn(),
  mockGetQueueStatus: vi.fn(),
  mockBroadcast: vi.fn(),
  mockBroadcastToTenant: vi.fn(),
  mockBroadcastToUser: vi.fn(),
}));

vi.mock('data-orchestration/services', () => ({
  sseConnectionManager: {
    getMetrics: mockGetMetrics,
    getMetricsHistory: mockGetMetricsHistory,
    getConnectionsByTenant: mockGetConnectionsByTenant,
    getConnectionsByUser: mockGetConnectionsByUser,
    findStaleConnections: mockFindStaleConnections,
    findTimedOutConnections: mockFindTimedOutConnections,
    cleanupConnections: mockCleanupConnections,
    getConnection: mockGetConnection,
    unregisterConnection: mockUnregisterConnection,
    getDegradationStatus: mockGetDegradationStatus,
    getQueueStatus: mockGetQueueStatus,
    broadcast: mockBroadcast,
    broadcastToTenant: mockBroadcastToTenant,
    broadcastToUser: mockBroadcastToUser,
  },
}));

import { GET, POST } from '../route';

function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: { body?: object; searchParams?: Record<string, string>; role?: string }
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
      'x-user-role': options?.role || 'admin',
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

function createUnauthenticatedRequest(method: string, url: string): NextRequest {
  return new NextRequest(url, { method });
}

describe('GET /api/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/connections');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 for non-admin users', async () => {
    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/connections', {
      role: 'member',
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
  });

  it('returns metrics by default', async () => {
    mockGetMetrics.mockReturnValue({ totalConnections: 5, activeConnections: 3 });

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/connections');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalConnections).toBe(5);
    expect(data.data.timestamp).toBeDefined();
  });

  it('returns metrics history when action=history', async () => {
    mockGetMetricsHistory.mockReturnValue({ history: [] });

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/connections', {
      searchParams: { action: 'history' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGetMetricsHistory).toHaveBeenCalled();
  });

  it('returns stale connections when action=stale', async () => {
    mockFindStaleConnections.mockReturnValue([]);
    mockFindTimedOutConnections.mockReturnValue([]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/connections', {
      searchParams: { action: 'stale' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.stale).toBeDefined();
    expect(data.data.timedOut).toBeDefined();
  });
});

describe('POST /api/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/connections');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('performs cleanup', async () => {
    mockCleanupConnections.mockReturnValue(2);

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/connections', {
      body: { action: 'cleanup' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.cleanedCount).toBe(2);
  });

  it('returns 400 for invalid action', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/connections', {
      body: { action: 'invalid' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
