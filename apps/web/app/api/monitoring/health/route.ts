/**
 * Enhanced Health Check Endpoint
 * Kubernetes-compatible liveness and readiness probes
 * 
 * @endpoint GET /api/monitoring/health
 * @query probe - 'liveness' | 'readiness' | 'startup' (default: full health check)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Redis } from '@upstash/redis';
import { alerts } from '@/lib/alerting';
import { monitoringService } from 'data-orchestration/services';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    memory: ComponentHealth;
    disk?: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

// Memory thresholds
const MEMORY_WARNING_THRESHOLD = 0.85; // 85%
const MEMORY_CRITICAL_THRESHOLD = 0.95; // 95%

export const GET = withApiHandler(async (request: NextRequest, ctx) => {
  const startTime = Date.now();
  const probe = request.nextUrl.searchParams.get('probe');

  // Liveness probe - just check if process is alive
  if (probe === 'liveness') {
    return createSuccessResponse(ctx, {
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  }

  // Startup probe - check if app has initialized
  if (probe === 'startup') {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return createSuccessResponse(ctx, {
        status: 'started',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return createErrorResponse(
        ctx, 'SERVICE_UNAVAILABLE',
        'Database not ready',
        503
      );
    }
  }

  // Full health check (readiness or default)
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '2.0.0',
    checks: {
      database: { status: 'down' },
      redis: { status: 'down' },
      memory: { status: 'down' },
    },
  };

  // Check Database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'up',
      latencyMs: Date.now() - dbStart,
    };
  } catch (error) {
    health.checks.database = {
      status: 'down',
      latencyMs: Date.now() - dbStart,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
    health.status = 'unhealthy';
    // Send alert for database down
    alerts.databaseDown().catch(() => {});
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      const redis = new Redis({
        url: redisUrl,
        token: redisToken,
      });
      
      const ping = await redis.ping();
      if (ping === 'PONG') {
        health.checks.redis = {
          status: 'up',
          latencyMs: Date.now() - redisStart,
        };
      } else {
        throw new Error('Invalid ping response');
      }
    } else {
      health.checks.redis = {
        status: 'degraded',
        message: 'Redis not configured',
      };
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }
  } catch (error) {
    health.checks.redis = {
      status: 'down',
      latencyMs: Date.now() - redisStart,
      message: error instanceof Error ? error.message : 'Redis connection failed',
    };
    // Redis failure is degraded, not unhealthy (app can work without cache)
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
    // Send alert for redis down
    alerts.redisDown().catch(() => {});
  }

  // Check Memory
  const memoryUsage = process.memoryUsage();
  const heapUsedRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

  if (heapUsedRatio >= MEMORY_CRITICAL_THRESHOLD) {
    health.checks.memory = {
      status: 'down',
      message: 'Critical memory usage',
      details: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        usagePercent: Math.round(heapUsedRatio * 100),
      },
    };
    health.status = 'unhealthy';
    // Send alert for critical memory
    alerts.highMemoryUsage(Math.round(heapUsedRatio * 100)).catch(() => {});
  } else if (heapUsedRatio >= MEMORY_WARNING_THRESHOLD) {
    health.checks.memory = {
      status: 'degraded',
      message: 'High memory usage',
      details: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        usagePercent: Math.round(heapUsedRatio * 100),
      },
    };
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
  } else {
    health.checks.memory = {
      status: 'up',
      details: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        usagePercent: Math.round(heapUsedRatio * 100),
        rss: memoryUsage.rss,
      },
    };
  }

  // Add response time
  const responseTime = Date.now() - startTime;

  // Determine HTTP status
  const httpStatus = health.status === 'unhealthy' ? 503 : 200;

  if (httpStatus === 503) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'System unhealthy', 503);
  }

  return createSuccessResponse(
    ctx,
    {
      ...health,
      responseTimeMs: responseTime,
    },
    {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`,
      },
    }
  );
});
