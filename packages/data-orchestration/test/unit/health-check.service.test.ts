/**
 * Unit Tests for Health Check Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthCheckService } from '../../src/services/health-check.service';

// Mock the database manager
vi.mock('clients-db', () => ({
  getDatabaseManager: vi.fn(() => ({
    getClient: vi.fn(() => ({
      $queryRaw: vi.fn(),
      contract: {
        count: vi.fn(),
      },
    })),
    getMetrics: vi.fn(() => ({
      activeConnections: 5,
      totalQueries: 100,
      slowQueries: 2,
      averageQueryTime: 50,
      errorRate: 0.01,
    })),
  })),
}));

// Mock the cache
vi.mock('../../src/services/multi-level-cache.service', () => ({
  multiLevelCache: {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    getStats: vi.fn(() => ({
      l1Size: 10,
      l2Connected: true,
      hitRate: 0.85,
      totalRequests: 100,
    })),
  },
}));

// Mock event bus
vi.mock('../../src/events/event-bus', () => ({
  eventBus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    listenerCount: vi.fn(() => 5),
    getMaxListeners: vi.fn(() => 100),
  },
  Events: {
    CONTRACT_CREATED: 'contract:created',
  },
}));

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    service = new HealthCheckService();
    vi.clearAllMocks();
  });

  describe('checkDatabase', () => {
    it('should return healthy status when database is accessible', async () => {
      const result = await service.checkDatabase();

      expect(result.status).toBe('healthy');
      expect(result.latency).toBeDefined();
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.message).toContain('operational');
      expect(result.details).toBeDefined();
    });

    it('should return unhealthy status when database query fails', async () => {
      const { getDatabaseManager } = await import('clients-db');
      const mockManager = getDatabaseManager as any;
      mockManager.mockReturnValue({
        getClient: () => ({
          $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
          contract: { count: vi.fn() },
        }),
        getMetrics: vi.fn(),
      });

      const result = await service.checkDatabase();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('failed');
    });
  });

  describe('checkCache', () => {
    it('should return healthy status when cache is accessible', async () => {
      const result = await service.checkCache();

      expect(result.status).toBe('healthy');
      expect(result.message).toContain('operational');
      expect(result.details).toBeDefined();
    });
  });

  describe('checkEventBus', () => {
    it('should return healthy status when event bus is operational', async () => {
      const result = await service.checkEventBus();

      expect(result.status).toBe('healthy');
      expect(result.message).toContain('operational');
    });
  });

  describe('checkSSE', () => {
    it('should return healthy status with connection count', async () => {
      const result = await service.checkSSE();

      expect(result.status).toBe('healthy');
      expect(result.details).toBeDefined();
      expect(result.details?.activeConnections).toBeDefined();
    });
  });

  describe('getOverallHealth', () => {
    it('should return overall health status', async () => {
      const result = await service.getOverallHealth();

      expect(result.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(result.checks.database).toBeDefined();
      expect(result.checks.cache).toBeDefined();
      expect(result.checks.eventBus).toBeDefined();
      expect(result.checks.sse).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.version).toBeDefined();
    });
  });

  describe('getUptime', () => {
    it('should return uptime in milliseconds', () => {
      const uptime = service.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getFormattedUptime', () => {
    it('should return formatted uptime string', () => {
      const formatted = service.getFormattedUptime();
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
});
