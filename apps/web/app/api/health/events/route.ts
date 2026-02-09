import { NextRequest } from 'next/server';
import { healthCheckService } from 'data-orchestration/services';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Event bus-specific health check endpoint
 */
export const GET = withApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const eventBusHealth = await healthCheckService.checkEventBus();
    
    const statusCode = eventBusHealth.status === 'healthy' ? 200 : eventBusHealth.status === 'degraded' ? 200 : 503;
    
    if (statusCode === 503) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Event bus unhealthy', 503);
    }
    return createSuccessResponse(ctx, eventBusHealth, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Event bus health check failed', 503, {
      details: (error as Error).message,
    });
  }
});
