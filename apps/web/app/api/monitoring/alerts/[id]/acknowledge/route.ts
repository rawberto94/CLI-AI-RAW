import { NextRequest } from 'next/server';
import { alertingService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/monitoring/alerts/[id]/acknowledge
 * Acknowledge an alert
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const alertId = params.id;
    const success = alertingService.acknowledgeAlert(alertId);

    if (!success) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Alert not found', 404);
    }

    return createSuccessResponse(ctx, {
      success: true,
      alertId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
