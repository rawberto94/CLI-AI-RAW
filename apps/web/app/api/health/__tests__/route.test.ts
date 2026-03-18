import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetOverallHealth, mockGetFormattedUptime, mockGetUptime } = vi.hoisted(() => ({
  mockGetOverallHealth: vi.fn(),
  mockGetFormattedUptime: vi.fn(),
  mockGetUptime: vi.fn(),
}));

vi.mock('data-orchestration/services', () => ({
  healthCheckService: {
    getOverallHealth: mockGetOverallHealth,
    getFormattedUptime: mockGetFormattedUptime,
    getUptime: mockGetUptime,
  },
}));

import { GET } from '../route';

function createRequest(url = 'http://localhost:3000/api/health'): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with healthy status', async () => {
    mockGetOverallHealth.mockResolvedValue({
      status: 'healthy',
      timestamp: '2026-01-01T00:00:00Z',
      version: '1.0.0',
    });
    mockGetFormattedUptime.mockReturnValue('2d 3h 15m');
    mockGetUptime.mockReturnValue(60000);

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.uptime).toBe('2d 3h 15m');
    expect(data.version).toBe('1.0.0');
    expect(data.timestamp).toBe('2026-01-01T00:00:00Z');
  });

  it('returns 200 with degraded status', async () => {
    mockGetOverallHealth.mockResolvedValue({
      status: 'degraded',
      timestamp: '2026-01-01T00:00:00Z',
      version: '1.0.0',
    });
    mockGetFormattedUptime.mockReturnValue('1h 5m');
    mockGetUptime.mockReturnValue(60000);

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('degraded');
  });

  it('returns 503 when unhealthy', async () => {
    mockGetOverallHealth.mockResolvedValue({
      status: 'unhealthy',
      timestamp: '2026-01-01T00:00:00Z',
      version: '1.0.0',
    });
    mockGetFormattedUptime.mockReturnValue('0m');
    mockGetUptime.mockReturnValue(60000);

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
  });

  it('returns 503 when health check throws', async () => {
    mockGetOverallHealth.mockRejectedValue(new Error('Database connection failed'));
    mockGetFormattedUptime.mockReturnValue('0m');
    mockGetUptime.mockReturnValue(60000);

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.error).toBe('Database connection failed');
  });

  it('includes expected fields in response', async () => {
    mockGetOverallHealth.mockResolvedValue({
      status: 'healthy',
      timestamp: '2026-01-01T00:00:00Z',
      version: '1.0.0',
    });
    mockGetFormattedUptime.mockReturnValue('5m');
    mockGetUptime.mockReturnValue(60000);

    const response = await GET(createRequest());
    const data = await response.json();

    expect(data.status).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeDefined();
    expect(data.version).toBeDefined();
  });
});
