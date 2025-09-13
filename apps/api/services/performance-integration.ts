import { FastifyInstance } from 'fastify';
import { batchProcessor } from './batch-processor';
import { streamManager, registerStreamRoutes } from './stream-manager';
import { paginationService, registerPaginationRoutes } from './pagination-service';
import { getDefaultPool } from './database-pool';
import { cacheManager } from './cache-manager';
import { performanceMonitor, createPerformanceMiddleware } from './performance-monitor';

/**
 * Register all performance optimization routes and middleware
 */
export function registerPerformanceOptimizations(fastify: FastifyInstance) {
  // Start monitoring systems
  performanceMonitor.start();

  // Register performance middleware
  fastify.addHook('preHandler', createPerformanceMiddleware());

  // Register streaming routes
  registerStreamRoutes(fastify);

  // Register pagination routes
  registerPaginationRoutes(fastify);

  // Register batch processing routes
  registerBatchRoutes(fastify);

  // Register cache management routes
  registerCacheRoutes(fastify);

  // Register database pool routes
  registerDatabaseRoutes(fastify);

  // Register monitoring routes
  registerMonitoringRoutes(fastify);

  console.log('Performance optimizations registered successfully');
}

/**
 * Register batch processing routes
 */
function registerBatchRoutes(fastify: FastifyInstance) {
  // Submit a batch job
  fastify.post('/api/v1/batch/contracts', async (request, reply) => {
    const { contractFiles, priority, callback } = request.body as {
      contractFiles: Array<{
        id: string;
        filePath: string;
        fileName: string;
        fileType: string;
        metadata?: Record<string, any>;
      }>;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      callback?: {
        url: string;
        headers?: Record<string, string>;
      };
    };

    const tenantId = request.headers['x-tenant-id'] as string;

    try {
      const jobId = await batchProcessor.submitBatch(contractFiles, {
        priority,
        tenantId,
        callback
      });

      reply.code(201).send({
        success: true,
        jobId,
        message: `Batch job submitted with ${contractFiles.length} contracts`
      });
    } catch (error) {
      reply.code(400).send({
        error: 'Failed to submit batch job',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get batch job status
  fastify.get('/api/v1/batch/contracts/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const jobStatus = batchProcessor.getJobStatus(jobId);
    if (!jobStatus) {
      reply.code(404).send({ error: 'Job not found' });
      return;
    }

    reply.send(jobStatus);
  });

  // Cancel a batch job
  fastify.delete('/api/v1/batch/contracts/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    const cancelled = await batchProcessor.cancelJob(jobId);
    if (!cancelled) {
      reply.code(400).send({ error: 'Job cannot be cancelled or not found' });
      return;
    }

    reply.send({ success: true, message: 'Job cancelled successfully' });
  });

  // Get batch processing statistics
  fastify.get('/api/v1/batch/stats', async (request, reply) => {
    const stats = batchProcessor.getStats();
    reply.send(stats);
  });

  // Get jobs by tenant
  fastify.get('/api/v1/batch/tenant/:tenantId/jobs', async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const jobs = batchProcessor.getJobsByTenant(tenantId);
    reply.send({ jobs });
  });
}

/**
 * Register cache management routes
 */
function registerCacheRoutes(fastify: FastifyInstance) {
  // Get cache statistics
  fastify.get('/api/v1/cache/stats', async (request, reply) => {
    const stats = cacheManager.getStats();
    reply.send(stats);
  });

  // Get cached value with metadata
  fastify.get('/api/v1/cache/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    
    const result = await cacheManager.getWithMetadata(key);
    if (!result) {
      reply.code(404).send({ error: 'Cache entry not found' });
      return;
    }

    reply.send(result);
  });

  // Set cache value
  fastify.put('/api/v1/cache/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const { value, ttl, layers, tags, contentType } = request.body as {
      value: any;
      ttl?: number;
      layers?: string[];
      tags?: string[];
      contentType?: string;
    };

    const success = await cacheManager.set(key, value, {
      ttl,
      layers,
      tags,
      contentType
    });

    if (success) {
      reply.send({ success: true, message: 'Cache entry set successfully' });
    } else {
      reply.code(500).send({ error: 'Failed to set cache entry' });
    }
  });

  // Delete cache entry
  fastify.delete('/api/v1/cache/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    
    const success = await cacheManager.delete(key);
    reply.send({ success, message: success ? 'Cache entry deleted' : 'Cache entry not found' });
  });

  // Clear all cache
  fastify.delete('/api/v1/cache', async (request, reply) => {
    const success = await cacheManager.clear();
    reply.send({ success, message: success ? 'Cache cleared successfully' : 'Failed to clear cache' });
  });

  // Invalidate cache by tag
  fastify.post('/api/v1/cache/invalidate', async (request, reply) => {
    const { tag } = request.body as { tag: string };
    
    const success = await cacheManager.invalidateByTag(tag);
    reply.send({ success, message: `Cache invalidated for tag: ${tag}` });
  });

  // Warm cache with data
  fastify.post('/api/v1/cache/warm', async (request, reply) => {
    const { data } = request.body as {
      data: Array<{ key: string; value: any; ttl?: number }>;
    };

    await cacheManager.warmCache(data);
    reply.send({ success: true, message: `Cache warmed with ${data.length} entries` });
  });
}

/**
 * Register database pool management routes
 */
function registerDatabaseRoutes(fastify: FastifyInstance) {
  // Get database pool health
  fastify.get('/api/v1/database/health', async (request, reply) => {
    const pool = getDefaultPool();
    const health = await pool.healthCheck();
    reply.send(health);
  });

  // Get database pool statistics
  fastify.get('/api/v1/database/stats', async (request, reply) => {
    const pool = getDefaultPool();
    const stats = pool.getStats();
    const connections = pool.getConnectionDetails();
    
    reply.send({
      stats,
      connections: connections.length,
      connectionDetails: connections
    });
  });

  // Execute a test query
  fastify.post('/api/v1/database/test', async (request, reply) => {
    const { query, params } = request.body as {
      query?: string;
      params?: any[];
    };

    const pool = getDefaultPool();
    
    try {
      const testQuery = query || 'SELECT 1 as test';
      const result = await pool.query(testQuery, params);
      
      reply.send({
        success: true,
        result,
        message: 'Query executed successfully'
      });
    } catch (error) {
      reply.code(500).send({
        error: 'Query execution failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

/**
 * Register monitoring and metrics routes
 */
function registerMonitoringRoutes(fastify: FastifyInstance) {
  // Get system health overview
  fastify.get('/api/v1/monitoring/health', async (request, reply) => {
    const health = await performanceMonitor.getSystemHealth();
    reply.send(health);
  });

  // Get performance metrics
  fastify.get('/api/v1/monitoring/metrics', async (request, reply) => {
    const { name, startTime, endTime, aggregation, timeWindow } = request.query as {
      name?: string;
      startTime?: string;
      endTime?: string;
      aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
      timeWindow?: string;
    };

    if (name && aggregation && timeWindow) {
      const value = performanceMonitor.getAggregatedMetrics(
        name,
        aggregation,
        parseInt(timeWindow)
      );
      reply.send({ metric: name, aggregation, value, timeWindow });
    } else if (name) {
      const start = startTime ? new Date(startTime) : undefined;
      const end = endTime ? new Date(endTime) : undefined;
      const metrics = performanceMonitor.getMetrics(name, start, end);
      reply.send({ metric: name, data: metrics });
    } else {
      // Return overview of all metrics
      reply.send({ error: 'Please specify metric name' });
    }
  });

  // Record custom metric
  fastify.post('/api/v1/monitoring/metrics', async (request, reply) => {
    const { name, value, tags, unit } = request.body as {
      name: string;
      value: number;
      tags?: Record<string, string>;
      unit?: string;
    };

    performanceMonitor.recordMetric(name, value, tags, unit);
    
    reply.send({
      success: true,
      message: `Metric ${name} recorded with value ${value}`
    });
  });

  // Get active alerts
  fastify.get('/api/v1/monitoring/alerts', async (request, reply) => {
    const alerts = performanceMonitor.getActiveAlerts();
    reply.send({ alerts });
  });

  // Get alert rules
  fastify.get('/api/v1/monitoring/alert-rules', async (request, reply) => {
    const rules = performanceMonitor.getAlertRules();
    reply.send({ rules });
  });

  // Add alert rule
  fastify.post('/api/v1/monitoring/alert-rules', async (request, reply) => {
    const rule = request.body as {
      id: string;
      name: string;
      metric: string;
      condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
      threshold: number;
      duration: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      enabled: boolean;
      notificationChannels: string[];
    };

    performanceMonitor.addAlertRule(rule);
    
    reply.code(201).send({
      success: true,
      message: `Alert rule ${rule.name} added successfully`
    });
  });

  // Resolve alert
  fastify.post('/api/v1/monitoring/alerts/:alertId/resolve', async (request, reply) => {
    const { alertId } = request.params as { alertId: string };
    
    const resolved = performanceMonitor.resolveAlert(alertId);
    
    if (resolved) {
      reply.send({ success: true, message: 'Alert resolved successfully' });
    } else {
      reply.code(404).send({ error: 'Alert not found or already resolved' });
    }
  });

  // Get performance trends
  fastify.get('/api/v1/monitoring/trends', async (request, reply) => {
    const { timeWindow } = request.query as { timeWindow?: string };
    
    const trends = performanceMonitor.getPerformanceTrends(
      timeWindow ? parseInt(timeWindow) : undefined
    );
    
    reply.send(trends);
  });

  // Export metrics in Prometheus format
  fastify.get('/metrics', async (request, reply) => {
    const metrics = performanceMonitor.exportPrometheusMetrics();
    
    reply
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(metrics);
  });

  // Dashboard data endpoint
  fastify.get('/api/v1/monitoring/dashboard', async (request, reply) => {
    const health = await performanceMonitor.getSystemHealth();
    const trends = performanceMonitor.getPerformanceTrends();
    const batchStats = batchProcessor.getStats();
    const cacheStats = cacheManager.getStats();
    
    reply.send({
      health,
      trends,
      batchProcessing: batchStats,
      cache: cacheStats,
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Graceful shutdown handler
 */
export async function shutdownPerformanceOptimizations() {
  console.log('Shutting down performance optimizations...');
  
  try {
    // Stop monitoring
    performanceMonitor.stop();
    
    // Shutdown database pool
    const pool = getDefaultPool();
    await pool.shutdown();
    
    console.log('Performance optimizations shutdown complete');
  } catch (error) {
    console.error('Error during performance optimizations shutdown:', error);
  }
}

/**
 * Example usage with caching decorator
 */
export class OptimizedContractService {
  // Cache contract summary for 10 minutes in memory and Redis
  async getContractSummary(contractId: string): Promise<any> {
    const cacheKey = `contract:summary:${contractId}`;
    
    // Try cache first
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Simulate expensive operation
    const summary = {
      id: contractId,
      title: `Contract ${contractId}`,
      parties: ['Company A', 'Company B'],
      status: 'active',
      lastUpdated: new Date().toISOString()
    };

    // Cache for 10 minutes
    await cacheManager.set(cacheKey, summary, {
      ttl: 600,
      layers: ['memory', 'redis'],
      tags: ['contract', 'summary']
    });

    return summary;
  }

  // Batch process multiple contracts
  async processContractsBatch(contractIds: string[]): Promise<string> {
    const contractFiles = contractIds.map(id => ({
      id,
      filePath: `/contracts/${id}.pdf`,
      fileName: `contract-${id}.pdf`,
      fileType: 'pdf'
    }));

    const jobId = await batchProcessor.submitBatch(contractFiles, {
      priority: 'normal'
    });

    return jobId;
  }

  // Get contracts with advanced pagination
  async getContractsPaginated(params: any, tenantId?: string): Promise<any> {
    return await paginationService.smartPaginate('auto', params, tenantId);
  }

  // Execute database query with connection pooling
  async executeQuery(sql: string, params?: any[]): Promise<any> {
    const pool = getDefaultPool();
    return await pool.query(sql, params);
  }
}
