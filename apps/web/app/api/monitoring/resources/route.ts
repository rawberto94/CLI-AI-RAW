/**
 * Resource Monitoring API
 * Provides endpoints for monitoring system resources (memory, CPU, connections)
 */

import { NextRequest } from 'next/server';
import { resourceMonitor } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type ApiContext, getApiContext} from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/monitoring/resources
 * Get resource metrics and statistics
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  switch (action) {
    case 'current':
      return getCurrentMetrics(ctx);

    case 'history':
      return getMetricsHistory(ctx, searchParams);

    case 'summary':
      return getMetricsSummary(ctx, searchParams);

    case 'collect':
      return collectMetrics(ctx);

    default:
      return getCurrentMetrics(ctx);
  }
});

/**
 * Get current resource metrics
 */
async function getCurrentMetrics(ctx: ApiContext) {
  const metrics = resourceMonitor.getCurrentMetrics();
  
  if (!metrics) {
    // Collect metrics if none available
    const freshMetrics = await resourceMonitor.collectMetrics();
    return createSuccessResponse(ctx, formatMetrics(freshMetrics));
  }

  return createSuccessResponse(ctx, formatMetrics(metrics));
}

/**
 * Get metrics history
 */
function getMetricsHistory(ctx: ApiContext, searchParams: URLSearchParams) {
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 200) : undefined;

  const history = resourceMonitor.getMetricsHistory(limit);
  
  return createSuccessResponse(ctx, {
      count: history.length,
      metrics: history.map(formatMetrics),
  });
}

/**
 * Get metrics summary
 */
function getMetricsSummary(ctx: ApiContext, searchParams: URLSearchParams) {
  const durationParam = searchParams.get('duration');
  const duration = durationParam ? parseInt(durationParam, 10) : 3600000; // Default 1 hour

  const summary = resourceMonitor.getMetricsSummary(duration);
  
  return createSuccessResponse(ctx, {
      duration,
      durationFormatted: formatDuration(duration),
      summary: {
        memory: {
          avg: summary.memory.avg.toFixed(2) + '%',
          min: summary.memory.min.toFixed(2) + '%',
          max: summary.memory.max.toFixed(2) + '%',
        },
        cpu: {
          avg: summary.cpu.avg.toFixed(2) + '%',
          min: summary.cpu.min.toFixed(2) + '%',
          max: summary.cpu.max.toFixed(2) + '%',
        },
        connections: {
          avg: Math.round(summary.connections.avg),
          min: summary.connections.min,
          max: summary.connections.max,
        },
      },
  });
}

/**
 * Collect fresh metrics
 */
async function collectMetrics(ctx: ApiContext) {
  const metrics = await resourceMonitor.collectMetrics();
  
  return createSuccessResponse(ctx, formatMetrics(metrics));
}

interface MetricsData {
  timestamp: string | Date;
  memory: {
    heapUsed: number;
    heapTotal: number;
    heapUtilization: number;
    external: number;
    rss: number;
    arrayBuffers: number;
    cacheSize: number;
    cacheEntries: number;
    cacheUtilization: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
    model: string;
    speed: number;
  };
  connections: {
    total: number;
    active: number;
    queued: number;
    byState: Record<string, number>;
    byTenant: Record<string, number>;
  };
  system: {
    platform: string;
    uptime: number;
    freeMemory: number;
    totalMemory: number;
    memoryUtilization: number;
    hostname: string;
  };
}

/**
 * Format metrics for response
 */
function formatMetrics(metrics: MetricsData) {
  return {
    timestamp: metrics.timestamp,
    memory: {
      heapUsed: metrics.memory.heapUsed,
      heapTotal: metrics.memory.heapTotal,
      heapUtilization: metrics.memory.heapUtilization.toFixed(2) + '%',
      external: metrics.memory.external,
      rss: metrics.memory.rss,
      arrayBuffers: metrics.memory.arrayBuffers,
      cacheSize: metrics.memory.cacheSize,
      cacheEntries: metrics.memory.cacheEntries,
      cacheUtilization: metrics.memory.cacheUtilization.toFixed(2) + '%',
      formatted: {
        heapUsed: formatBytes(metrics.memory.heapUsed),
        heapTotal: formatBytes(metrics.memory.heapTotal),
        external: formatBytes(metrics.memory.external),
        rss: formatBytes(metrics.memory.rss),
        cacheSize: formatBytes(metrics.memory.cacheSize),
      },
    },
    cpu: {
      usage: metrics.cpu.usage.toFixed(2) + '%',
      loadAverage: metrics.cpu.loadAverage.map((v: number) => v.toFixed(2)),
      cores: metrics.cpu.cores,
      model: metrics.cpu.model,
      speed: metrics.cpu.speed + ' MHz',
    },
    connections: {
      total: metrics.connections.total,
      active: metrics.connections.active,
      queued: metrics.connections.queued,
      byState: metrics.connections.byState,
      byTenant: metrics.connections.byTenant,
    },
    system: {
      platform: metrics.system.platform,
      uptime: formatDuration(metrics.system.uptime * 1000),
      freeMemory: metrics.system.freeMemory,
      totalMemory: metrics.system.totalMemory,
      memoryUtilization: metrics.system.memoryUtilization.toFixed(2) + '%',
      hostname: metrics.system.hostname,
      formatted: {
        freeMemory: formatBytes(metrics.system.freeMemory),
        totalMemory: formatBytes(metrics.system.totalMemory),
      },
    },
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration to human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
