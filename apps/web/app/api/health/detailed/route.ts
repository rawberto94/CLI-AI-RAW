import { NextRequest } from 'next/server';
import { healthCheckService } from 'data-orchestration/services';
import { withPublicApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Detailed health check endpoint
 * Returns comprehensive health information for all system components
 */
export const GET = withPublicApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const health = await healthCheckService.getOverallHealth();
    
    // Add system metrics
    const memUsage = process.memoryUsage();
    const systemMetrics = {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
        percentage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
      },
      process: {
        uptime: healthCheckService.getFormattedUptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
      },
    };
    
    const response = {
      ...health,
      system: systemMetrics,
    };
    
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    if (statusCode === 503) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'System unhealthy', 503);
    }
    return createSuccessResponse(ctx, response, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', (error as Error).message, 503, {
      details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
    });
  }
});
