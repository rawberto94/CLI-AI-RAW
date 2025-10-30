/**
 * Unit Tests for Monitoring Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { monitoringService } from '../../src/services/monitoring.service';

describe('MonitoringService', () => {
  beforeEach(() => {
    // Clear metrics before each test
    monitoringService.clearMetrics();
    monitoringService.clearLogs();
  });

  describe('recordMetric', () => {
    it('should record a metric with value and tags', () => {
      expect(() => {
        monitoringService.recordMetric('api.response.time', 150, { endpoint: '/api/contracts' });
      }).not.toThrow();
      
      const stats = monitoringService.getMetricStats('api.response.time', { endpoint: '/api/contracts' });
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(1);
    });

    it('should handle metrics without tags', () => {
      expect(() => {
        monitoringService.recordMetric('cache.hit', 1);
      }).not.toThrow();
      
      const stats = monitoringService.getMetricStats('cache.hit');
      expect(stats).toBeDefined();
    });
  });

  describe('incrementCounter', () => {
    it('should increment a counter', () => {
      monitoringService.incrementCounter('api.requests', { method: 'GET' });
      const count = monitoringService.getCounter('api.requests', { method: 'GET' });
      expect(count).toBe(1);
    });

    it('should increment counter multiple times', () => {
      monitoringService.incrementCounter('test.counter');
      monitoringService.incrementCounter('test.counter');
      monitoringService.incrementCounter('test.counter');

      const count = monitoringService.getCounter('test.counter');
      expect(count).toBe(3);
    });
  });

  describe('recordTiming', () => {
    it('should record timing with duration', () => {
      monitoringService.recordTiming('database.query', 45, { query: 'SELECT' });
      const stats = monitoringService.getMetricStats('database.query.duration', { query: 'SELECT' });
      expect(stats).toBeDefined();
      expect(stats?.avg).toBe(45);
    });

    it('should handle negative durations gracefully', () => {
      expect(() => {
        monitoringService.recordTiming('test.timing', -10);
      }).not.toThrow();
    });
  });

  describe('logInfo', () => {
    it('should log info message with context', () => {
      monitoringService.logInfo('User logged in', { userId: 'user-123' });
      const logs = monitoringService.getRecentLogs(10, 'info');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].message).toBe('User logged in');
    });

    it('should log info message without context', () => {
      monitoringService.logInfo('Application started');
      const logs = monitoringService.getRecentLogs(10, 'info');
      expect(logs.some(l => l.message === 'Application started')).toBe(true);
    });
  });

  describe('logWarning', () => {
    it('should log warning message', () => {
      monitoringService.logWarning('High memory usage', { usage: '85%' });
      const logs = monitoringService.getRecentLogs(10, 'warning');
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('logError', () => {
    it('should log error with context', () => {
      const error = new Error('Database connection failed');
      monitoringService.logError(error, { operation: 'query' });
      const logs = monitoringService.getRecentLogs(10, 'error');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].message).toBe('Database connection failed');
    });

    it('should handle errors without context', () => {
      const error = new Error('Unknown error');
      monitoringService.logError(error);
      const logs = monitoringService.getRecentLogs(10, 'error');
      expect(logs.some(l => l.message === 'Unknown error')).toBe(true);
    });
  });

  describe('startTrace and endTrace', () => {
    it('should create and end a trace', () => {
      const trace = monitoringService.startTrace('api.request');
      
      expect(trace).toBeDefined();
      expect(trace.id).toBeDefined();
      expect(trace.name).toBe('api.request');
      expect(trace.startTime).toBeDefined();

      monitoringService.endTrace(trace);
      
      expect(trace.endTime).toBeDefined();
      expect(trace.duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate duration correctly', async () => {
      const trace = monitoringService.startTrace('test.operation');
      
      // Wait 50ms
      await new Promise(resolve => setTimeout(resolve, 50));
      
      monitoringService.endTrace(trace);
      
      expect(trace.duration).toBeGreaterThanOrEqual(50);
      expect(trace.duration).toBeLessThan(150);
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics summary', () => {
      monitoringService.recordMetric('test.metric1', 100);
      monitoringService.incrementCounter('test.counter');

      const metrics = monitoringService.getSystemMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.counters).toBeDefined();
      expect(metrics.gauges).toBeDefined();
      expect(metrics.traces).toBeDefined();
      expect(metrics.logs).toBeDefined();
    });
  });

  describe('getRecentLogs', () => {
    it('should return recent log entries', () => {
      monitoringService.logInfo('Info message');
      monitoringService.logWarning('Warning message');
      monitoringService.logError(new Error('Error message'));

      const logs = monitoringService.getRecentLogs(10);
      
      expect(logs.length).toBeGreaterThanOrEqual(3);
      expect(logs.some(l => l.level === 'info')).toBe(true);
      expect(logs.some(l => l.level === 'warning')).toBe(true);
      expect(logs.some(l => l.level === 'error')).toBe(true);
    });
  });

  describe('getActiveTraces', () => {
    it('should return active traces', () => {
      const trace1 = monitoringService.startTrace('operation1');
      const trace2 = monitoringService.startTrace('operation2');
      
      const activeTraces = monitoringService.getActiveTraces();
      expect(activeTraces.length).toBeGreaterThanOrEqual(2);
      
      monitoringService.endTrace(trace1);
      monitoringService.endTrace(trace2);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      monitoringService.recordMetric('test.metric', 100);
      monitoringService.incrementCounter('test.counter');
      
      monitoringService.clearMetrics();
      
      const count = monitoringService.getCounter('test.counter');
      expect(count).toBe(0);
    });
  });
});
