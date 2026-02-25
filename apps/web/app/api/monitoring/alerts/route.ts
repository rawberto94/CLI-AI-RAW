import { NextRequest } from 'next/server';
import { alertingService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

/**
 * GET /api/monitoring/alerts
 * Returns active alerts and alert history
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const searchParams = request.nextUrl.searchParams;
  const includeHistory = searchParams.get('history') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50');

  const activeAlerts = alertingService.getActiveAlerts();
  const history = includeHistory ? alertingService.getAlertHistory(limit) : [];

  return createSuccessResponse(ctx, {
    active: activeAlerts,
    history,
    count: {
      active: activeAlerts.length,
      history: history.length,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/monitoring/alerts/check
 * Manually trigger threshold checks
 */
export const POST = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const newAlerts = await alertingService.checkThresholds();

  return createSuccessResponse(ctx, {
    newAlerts,
    count: newAlerts.length,
    timestamp: new Date().toISOString(),
  });
});
