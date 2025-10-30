/**
 * Unit Tests for SSE Connection Manager Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sseConnectionManager } from '../../src/services/sse-connection-manager.service';

describe('SSEConnectionManager', () => {
  beforeEach(() => {
    // Clear any existing connections
  });

  afterEach(() => {
    // Cleanup
  });

  describe('registerConnection', () => {
    it('should register a new connection', () => {
      const mockController = {
        enqueue: vi.fn(),
        close: vi.fn(),
      } as any;

      const connection = sseConnectionManager.registerConnection(
        mockController,
        'tenant-1',
        'user-1'
      );

      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.tenantId).toBe('tenant-1');
      expect(connection.userId).toBe('user-1');
      expect(connection.state).toBe('connected');
    });

    it('should track connection by tenant', () => {
      const mockController = { enqueue: vi.fn(), close: vi.fn() } as any;

      sseConnectionManager.registerConnection(mockController, 'tenant-1', 'user-1');
      
      const tenantConnections = sseConnectionManager.getConnectionsByTenant('tenant-1');
      expect(tenantConnections.length).toBeGreaterThan(0);
    });
  });

  describe('unregisterConnection', () => {
    it('should unregister an existing connection', () => {
      const mockController = { enqueue: vi.fn(), close: vi.fn() } as any;
      const connection = sseConnectionManager.registerConnection(mockController, 'tenant-1');

      const result = sseConnectionManager.unregisterConnection(connection.id);

      expect(result).toBe(true);
      const retrieved = sseConnectionManager.getConnection(connection.id);
      expect(retrieved).toBeUndefined();
    });

    it('should handle removing non-existent connection', () => {
      const result = sseConnectionManager.unregisterConnection('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should return connection metrics', () => {
      const metrics = sseConnectionManager.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalConnections).toBeDefined();
      expect(metrics.activeConnections).toBeDefined();
      expect(metrics.connectionsByTenant).toBeDefined();
      expect(metrics.connectionsByState).toBeDefined();
    });
  });

  describe('getDegradationStatus', () => {
    it('should return degradation status', () => {
      const status = sseConnectionManager.getDegradationStatus();

      expect(status).toBeDefined();
      expect(status.isDegraded).toBeDefined();
      expect(status.currentLoad).toBeDefined();
      expect(status.threshold).toBeDefined();
      expect(status.activeConnections).toBeDefined();
      expect(status.maxConnections).toBeDefined();
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', () => {
      const status = sseConnectionManager.getQueueStatus();

      expect(status).toBeDefined();
      expect(status.queueSize).toBeDefined();
      expect(status.maxQueueSize).toBeDefined();
      expect(status.averageQueueTime).toBeDefined();
    });
  });
});
