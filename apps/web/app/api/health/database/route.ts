import { NextRequest } from 'next/server';
import { healthCheckService } from 'data-orchestration/services';
import { withApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Database-specific health check endpoint
 */
export const GET = withApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const dbHealth = await healthCheckService.checkDatabase();
    
    const statusCode = dbHealth.status === 'healthy' ? 200 : dbHealth.status === 'degraded' ? 200 : 503;
    
    if (statusCode === 503) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Database unhealthy', 503);
    }
    return createSuccessResponse(ctx, dbHealth, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Database health check failed', 503, {
      details: (error as Error).message,
    });
  }
});
