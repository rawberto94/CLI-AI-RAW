import { NextRequest } from 'next/server';
import { alertingService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

/**
 * POST /api/monitoring/alerts/[id]/acknowledge
 * Acknowledge an alert (requires authentication)
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const params = await (ctx as any).params;
  const alertId = params?.id;

  if (!alertId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Alert ID is required', 400);
  }

  const success = alertingService.acknowledgeAlert(alertId);

  if (!success) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Alert not found', 404);
  }

  return createSuccessResponse(ctx, {
    success: true,
    alertId,
    acknowledgedBy: ctx.userId,
    timestamp: new Date().toISOString(),
  });
});
