import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
vi.mock('data-orchestration/services', () => ({
  sseConnectionManager: {
    getMetrics: vi.fn(),
    getMetricsHistory: vi.fn(),
    getConnectionsByTenant: vi.fn(),
    getConnectionsByUser: vi.fn(),
    getStaleConnections: vi.fn(),
    getDegradationStatus: vi.fn(),
    getQueueStatus: vi.fn(),
    performCleanup: vi.fn(),
    disconnectConnection: vi.fn(),
    broadcast: vi.fn(),
  },
}));

import { sseConnectionManager } from 'data-orchestration/services';

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/connections',
  body?: Record<string, unknown>
): NextRequest {
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url), options);
}

describe('GET /api/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return metrics by default', async () => {
    const mockMetrics = {
      totalConnections: 10,
      activeConnections: 8,
      averageLatency: 50,
    };

    vi.mocked(sseConnectionManager.getMetrics).mockReturnValue(mockMetrics);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(expect.objectContaining(mockMetrics));
  });

  it('should return metrics when action=metrics', async () => {
    const mockMetrics = {
      totalConnections: 5,
      activeConnections: 5,
    };

    vi.mocked(sseConnectionManager.getMetrics).mockReturnValue(mockMetrics);

    const request = createRequest('GET', 'http://localhost:3000/api/connections?action=metrics');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(sseConnectionManager.getMetrics).toHaveBeenCalled();
  });

  it('should return metrics history when action=history', async () => {
    const mockHistory = [
      { timestamp: Date.now() - 60000, connections: 5 },
      { timestamp: Date.now(), connections: 8 },
    ];

    vi.mocked(sseConnectionManager.getMetricsHistory).mockReturnValue(mockHistory);

    const request = createRequest('GET', 'http://localhost:3000/api/connections?action=history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(sseConnectionManager.getMetricsHistory).toHaveBeenCalled();
  });

  it('should return connections by tenant when action=tenant', async () => {
    const mockConnections = [
      { id: 'conn1', userId: 'u1', createdAt: Date.now() },
    ];

    vi.mocked(sseConnectionManager.getConnectionsByTenant).mockReturnValue(mockConnections);

    const request = createRequest('GET', 'http://localhost:3000/api/connections?action=tenant&tenantId=t1');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(sseConnectionManager.getConnectionsByTenant).toHaveBeenCalledWith('t1');
  });

  it('should return connections by user when action=user', async () => {
    const mockConnections = [
      { id: 'conn1', tenantId: 't1', createdAt: Date.now() },
    ];

    vi.mocked(sseConnectionManager.getConnectionsByUser).mockReturnValue(mockConnections);

    const request = createRequest('GET', 'http://localhost:3000/api/connections?action=user&userId=u1');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(sseConnectionManager.getConnectionsByUser).toHaveBeenCalledWith('u1');
  });

  it('should return stale connections when action=stale', async () => {
    const mockStale = [
      { id: 'conn1', lastActivity: Date.now() - 300000 },
    ];

    vi.mocked(sseConnectionManager.getStaleConnections).mockReturnValue(mockStale);

    const request = createRequest('GET', 'http://localhost:3000/api/connections?action=stale');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(sseConnectionManager.getStaleConnections).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(sseConnectionManager.getMetrics).mockImplementation(() => {
      throw new Error('Connection manager error');
    });

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.message).toBe('Connection manager error');
  });
});

describe('POST /api/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform cleanup when action=cleanup', async () => {
    vi.mocked(sseConnectionManager.performCleanup).mockReturnValue({
      cleaned: 3,
      remaining: 5,
    });

    const request = createRequest('POST', 'http://localhost:3000/api/connections', {
      action: 'cleanup',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sseConnectionManager.performCleanup).toHaveBeenCalled();
  });

  it('should disconnect connection when action=disconnect', async () => {
    vi.mocked(sseConnectionManager.disconnectConnection).mockReturnValue(true);

    const request = createRequest('POST', 'http://localhost:3000/api/connections', {
      action: 'disconnect',
      connectionId: 'conn1',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sseConnectionManager.disconnectConnection).toHaveBeenCalledWith('conn1');
  });

  it('should broadcast message when action=broadcast', async () => {
    vi.mocked(sseConnectionManager.broadcast).mockReturnValue({ sent: 10 });

    const request = createRequest('POST', 'http://localhost:3000/api/connections', {
      action: 'broadcast',
      message: { type: 'notification', data: 'test' },
      tenantId: 't1',
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sseConnectionManager.broadcast).toHaveBeenCalled();
  });

  it('should return error for unknown action', async () => {
    const request = createRequest('POST', 'http://localhost:3000/api/connections', {
      action: 'unknown',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});
