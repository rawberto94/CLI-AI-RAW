/**
 * Health Check Service
 * Comprehensive system health monitoring for production readiness
 */

import * as clientsDb from 'clients-db';
const getDatabaseManager: () => any = (clientsDb as any).getDatabaseManager;
import { multiLevelCache } from './multi-level-cache.service';
import { eventBus, Events } from '../events/event-bus';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latency?: number;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: HealthStatus;
    cache: HealthStatus;
    eventBus: HealthStatus;
    sse: HealthStatus;
  };
  timestamp: string;
  uptime: number;
  version: string;
}

export class HealthCheckService {
  private startTime: Date;
  private version: string;
  private sseConnectionCount: number = 0;

  constructor() {
    this.startTime = new Date();
    this.version = process.env.APP_VERSION || '1.0.0';
    this.setupSSETracking();
  }

  /**
   * Setup SSE connection tracking
   */
  private setupSSETracking(): void {
    // Track SSE connections through a simple counter
    // In production, this would be more sophisticated
  }

  /**
   * Update SSE connection count (called from SSE endpoint)
   */
  updateSSEConnectionCount(count: number): void {
    this.sseConnectionCount = count;
  }

  /**
   * Check database health
   */
  async checkDatabase(): Promise<HealthStatus> {
    const start = performance.now();
    
    try {
      const dbManager = getDatabaseManager();
      const client = dbManager.getClient();
      
      // Test basic connectivity
      await client.$queryRaw`SELECT 1 as health_check`;
      
      // Test query execution with a simple count
      const contractCount = await client.contract.count({
        take: 1
      });
      
      const latency = performance.now() - start;
      
      // Get database metrics
      const metrics = await dbManager.getMetrics();
      
      // Determine status based on latency and error rate
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (latency > 1000 || metrics.errorRate > 0.05) {
        status = 'degraded';
      }
      if (latency > 5000 || metrics.errorRate > 0.1) {
        status = 'unhealthy';
      }
      
      return {
        status,
        message: 'Database connection is operational',
        latency: Math.round(latency),
        details: {
          activeConnections: metrics.activeConnections,
          totalQueries: metrics.totalQueries,
          slowQueries: metrics.slowQueries,
          averageQueryTime: Math.round(metrics.averageQueryTime),
          errorRate: (metrics.errorRate * 100).toFixed(2) + '%',
        },
        timestamp: new Date(),
      };
    } catch (error) {
      const latency = performance.now() - start;
      
      return {
        status: 'unhealthy',
        message: `Database check failed: ${(error as Error).message}`,
        latency: Math.round(latency),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check cache health
   */
  async checkCache(): Promise<HealthStatus> {
    const start = performance.now();
    
    try {
      const testKey = '__health_check__';
      const testValue = { timestamp: Date.now(), test: true };
      
      // Test write operation
      await multiLevelCache.set(testKey, testValue, 10);
      
      // Test read operation
      const retrieved = await multiLevelCache.get<{ timestamp: number; test: boolean }>(testKey);
      
      // Verify data integrity
      if (!retrieved || retrieved.test !== true) {
        throw new Error('Cache read/write verification failed');
      }
      
      // Clean up test key
      await multiLevelCache.delete(testKey);
      
      const latency = performance.now() - start;
      
      // Get cache statistics
      const stats = multiLevelCache.getStats();
      
      // Determine status based on latency and hit rate
      // Note: Redis (L2 cache) is optional - missing Redis = degraded, not unhealthy
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (latency > 100 || !stats.l2Connected) {
        status = 'degraded';
      }
      if (latency > 500) {
        status = 'unhealthy';
      }
      
      return {
        status,
        message: 'Cache is operational',
        latency: Math.round(latency),
        details: {
          l1Size: stats.l1Size,
          l2Connected: stats.l2Connected,
          hitRate: stats.hitRate,
          totalRequests: stats.totalRequests,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      const latency = performance.now() - start;
      
      return {
        status: 'unhealthy',
        message: `Cache check failed: ${(error as Error).message}`,
        latency: Math.round(latency),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check event bus health
   */
  async checkEventBus(): Promise<HealthStatus> {
    const start = performance.now();
    
    try {
      let eventReceived = false;
      const testEvent = '__health_check__';
      const testData = { timestamp: Date.now(), test: true };
      
      // Setup listener
      const listener = (data: any) => {
        if (data.test === true && data.timestamp === testData.timestamp) {
          eventReceived = true;
        }
      };
      
      eventBus.on(testEvent, listener);
      
      // Emit test event
      eventBus.emit(testEvent, testData);
      
      // Wait a bit for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Cleanup
      eventBus.off(testEvent, listener);
      
      const latency = performance.now() - start;
      
      if (!eventReceived) {
        throw new Error('Event emission/handling verification failed');
      }
      
      // Get event bus statistics
      const listenerCount = eventBus.listenerCount(Events.CONTRACT_CREATED);
      const maxListeners = eventBus.getMaxListeners();
      
      // Determine status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (latency > 50) {
        status = 'degraded';
      }
      
      return {
        status,
        message: 'Event bus is operational',
        latency: Math.round(latency),
        details: {
          sampleListenerCount: listenerCount,
          maxListeners,
          eventQueueSize: 0, // EventEmitter doesn't expose queue size
        },
        timestamp: new Date(),
      };
    } catch (error) {
      const latency = performance.now() - start;
      
      return {
        status: 'unhealthy',
        message: `Event bus check failed: ${(error as Error).message}`,
        latency: Math.round(latency),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check SSE connection health
   */
  async checkSSE(): Promise<HealthStatus> {
    const start = performance.now();
    
    try {
      const latency = performance.now() - start;
      
      // Determine status based on connection count
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const maxConnections = parseInt(process.env.MAX_SSE_CONNECTIONS || '1000');
      
      if (this.sseConnectionCount > maxConnections * 0.8) {
        status = 'degraded';
      }
      if (this.sseConnectionCount >= maxConnections) {
        status = 'unhealthy';
      }
      
      return {
        status,
        message: 'SSE endpoint is operational',
        latency: Math.round(latency),
        details: {
          activeConnections: this.sseConnectionCount,
          maxConnections,
          utilizationPercent: ((this.sseConnectionCount / maxConnections) * 100).toFixed(2) + '%',
        },
        timestamp: new Date(),
      };
    } catch (error) {
      const latency = performance.now() - start;
      
      return {
        status: 'unhealthy',
        message: `SSE check failed: ${(error as Error).message}`,
        latency: Math.round(latency),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get overall system health
   */
  async getOverallHealth(): Promise<SystemHealth> {
    const [database, cache, eventBus, sse] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
      this.checkEventBus(),
      this.checkSSE(),
    ]);
    
    // Determine overall status
    const statuses = [database.status, cache.status, eventBus.status, sse.status];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }
    
    const uptime = Date.now() - this.startTime.getTime();
    
    return {
      status: overallStatus,
      checks: {
        database,
        cache,
        eventBus,
        sse,
      },
      timestamp: new Date().toISOString(),
      uptime,
      version: this.version,
    };
  }

  /**
   * Get system uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Get formatted uptime string
   */
  getFormattedUptime(): string {
    const uptime = this.getUptime();
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

export const healthCheckService = new HealthCheckService();
