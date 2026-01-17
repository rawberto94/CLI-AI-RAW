import { NextRequest, NextResponse } from 'next/server';
import { multiLevelCache } from 'data-orchestration/services';
import { poolMonitor } from '@/../../packages/data-orchestration/src/config/database-pool.config';

export async function GET(request: NextRequest) {
  try {
    // Get cache statistics
    const cacheStats = multiLevelCache.getStats();

    // Get database pool statistics
    const poolStats = poolMonitor.getMetrics();

    // Get system metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        total: process.memoryUsage().heapTotal / 1024 / 1024,
        rss: process.memoryUsage().rss / 1024 / 1024,
      },
      cpu: process.cpuUsage(),
    };

    // Calculate health score
    const healthScore = calculateHealthScore(cacheStats, poolStats);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      health: {
        score: healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'degraded' : 'unhealthy',
      },
      cache: cacheStats,
      database: poolStats,
      system: systemMetrics,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}

interface CacheStats {
  hitRate: string;
}

interface PoolStats {
  utilizationRate: number;
  slowQueryRate: number;
  errorRate: number;
}

function calculateHealthScore(cacheStats: CacheStats, poolStats: PoolStats): number {
  let score = 100;

  // Cache hit rate (target: >95%)
  const hitRate = parseFloat(cacheStats.hitRate);
  if (hitRate < 95) {
    score -= (95 - hitRate) * 2;
  }

  // Database pool utilization (target: <80%)
  if (poolStats.utilizationRate > 0.8) {
    score -= (poolStats.utilizationRate - 0.8) * 100;
  }

  // Slow query rate (target: <10%)
  if (poolStats.slowQueryRate > 0.1) {
    score -= (poolStats.slowQueryRate - 0.1) * 200;
  }

  // Error rate (target: <1%)
  if (poolStats.errorRate > 0.01) {
    score -= (poolStats.errorRate - 0.01) * 500;
  }

  return Math.max(0, Math.min(100, score));
}
