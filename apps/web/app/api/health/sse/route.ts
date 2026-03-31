import { NextRequest } from 'next/server';
import { healthCheckService } from 'data-orchestration/services';
import { withPublicApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE connection-specific health check endpoint
 */
export const GET = withPublicApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const sseHealth = await healthCheckService.checkSSE();
    
    const statusCode = sseHealth.status === 'healthy' ? 200 : sseHealth.status === 'degraded' ? 200 : 503;
    
    if (statusCode === 503) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'SSE unhealthy', 503);
    }
    return createSuccessResponse(ctx, sseHealth, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'SSE health check failed', 503, {
      details: (error as Error).message,
    });
  }
});
