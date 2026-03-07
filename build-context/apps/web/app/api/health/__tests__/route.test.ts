import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock dependencies
vi.mock('data-orchestration/services', () => ({
  healthCheckService: {
    getOverallHealth: vi.fn(),
    getFormattedUptime: vi.fn(),
  },
}));

// Import mocked modules
import { healthCheckService } from 'data-orchestration/services';

function createRequest(method: string = 'GET', url: string = 'http://localhost:3000/api/health'): NextRequest {
  return new NextRequest(new URL(url), { method });
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return healthy status with 200 when service is healthy', async () => {
    const mockHealth = {
      status: 'healthy',
      timestamp: '2024-03-15T12:00:00Z',
      version: '1.0.0',
    };
    
    vi.mocked(healthCheckService.getOverallHealth).mockResolvedValue(mockHealth);
    vi.mocked(healthCheckService.getFormattedUptime).mockReturnValue('1d 2h 30m');

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBe('2024-03-15T12:00:00Z');
    expect(data.uptime).toBe('1d 2h 30m');
    expect(data.version).toBe('1.0.0');
  });

  it('should return degraded status with 200 when service is degraded', async () => {
    const mockHealth = {
      status: 'degraded',
      timestamp: '2024-03-15T12:00:00Z',
      version: '1.0.0',
    };
    
    vi.mocked(healthCheckService.getOverallHealth).mockResolvedValue(mockHealth);
    vi.mocked(healthCheckService.getFormattedUptime).mockReturnValue('5h 15m');

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('degraded');
  });

  it('should return unhealthy status with 503 when service is unhealthy', async () => {
    const mockHealth = {
      status: 'unhealthy',
      timestamp: '2024-03-15T12:00:00Z',
      version: '1.0.0',
    };
    
    vi.mocked(healthCheckService.getOverallHealth).mockResolvedValue(mockHealth);
    vi.mocked(healthCheckService.getFormattedUptime).mockReturnValue('0m');

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
  });

  it('should return 503 with error message when health check fails', async () => {
    vi.mocked(healthCheckService.getOverallHealth).mockRejectedValue(new Error('Database connection failed'));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.error).toBe('Database connection failed');
    expect(data.timestamp).toBeDefined();
  });
});
