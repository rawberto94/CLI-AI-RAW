import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from 'data-orchestration/services';
import { withApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Basic health check endpoint
 * Returns simple status for load balancers and monitoring tools
 */
export const GET = withApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const health = await healthCheckService.getOverallHealth();
    
    // Simple response format for basic health checks
    const response = {
      status: health.status,
      timestamp: health.timestamp,
      uptime: healthCheckService.getFormattedUptime(),
      version: health.version,
    };
    
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    if (statusCode === 503) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'System unhealthy', 503);
    }
    return createSuccessResponse(ctx, response, { status: statusCode });
  } catch (error) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', (error as Error).message, 503);
  }
});
