import { NextRequest, NextResponse } from 'next/server';
import { monitoringService } from 'data-orchestration/services';

/**
 * GET /api/monitoring/metrics
 * Returns current system metrics
 */
export async function GET(request: NextRequest) {
  try {
    const systemMetrics = monitoringService.getSystemMetrics();
    const performanceMetrics = monitoringService.getPerformanceMetrics();
    
    // Get error rate
    const errorRate = monitoringService.getErrorRate(5);
    
    // Get API response time stats
    const apiStats: Record<string, any> = {};
    Object.keys(performanceMetrics.apiResponseTimes).forEach(endpoint => {
      const stats = monitoringService.getMetricStats('api.response.duration', { endpoint });
      if (stats) {
        apiStats[endpoint] = {
          avg: Math.round(stats.avg),
          p50: Math.round(stats.p50),
          p95: Math.round(stats.p95),
          p99: Math.round(stats.p99),
          count: stats.count,
        };
      }
    });
    
    // Get SSE connection count
    const sseConnections = monitoringService.getGauge('sse.connections.active') || 0;
    
    // Get cache metrics
    const cacheHits = monitoringService.getCounter('cache.hits');
    const cacheMisses = monitoringService.getCounter('cache.misses');
    const cacheHitRatio = cacheHits + cacheMisses > 0 
      ? (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(2)
      : '0.00';
    
    // Get event processing metrics
    const eventsEmitted = monitoringService.getCounter('events.emitted');
    const eventsProcessed = monitoringService.getCounter('events.processed');
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      system: systemMetrics,
      performance: {
        apiResponseTimes: apiStats,
        errorRate: errorRate.toFixed(2),
      },
      realTime: {
        sseConnections,
        eventsEmitted,
        eventsProcessed,
      },
      cache: {
        hits: cacheHits,
        misses: cacheMisses,
        hitRatio: cacheHitRatio,
      },
    });
  } catch (error) {
    console.error('[Monitoring API] Error fetching metrics:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
