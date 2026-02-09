import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from 'data-orchestration/services';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cache-specific health check endpoint
 */
export const GET = withApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const cacheHealth = await healthCheckService.checkCache();
    
    const statusCode = cacheHealth.status === 'healthy' ? 200 : cacheHealth.status === 'degraded' ? 200 : 503;
    
    if (statusCode === 503) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Cache unhealthy', 503);
    }
    return createSuccessResponse(ctx, cacheHealth, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Cache health check failed', 503, {
      details: (error as Error).message,
    });
  }
});
