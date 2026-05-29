import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { runAlertCheck } from '@/lib/alerts/alert-service';

// POST /api/alerts/check
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'manager') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin or manager access required', 403);
  }
  const body = await request.json().catch(() => ({}));
  const result = await runAlertCheck(ctx.tenantId, body.force === true);
  return createSuccessResponse(ctx, { result });
});
