import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { getAlertConfig, setAlertConfig } from '@/lib/alerts/alert-service';

// GET /api/alerts/config
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'manager') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin or manager access required', 403);
  }
  const config = await getAlertConfig(ctx.tenantId);
  return createSuccessResponse(ctx, { config });
});

// POST /api/alerts/config
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'manager') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin or manager access required', 403);
  }
  const body = await request.json();
  const updated = await setAlertConfig(ctx.tenantId, body);
  return createSuccessResponse(ctx, { config: updated });
});
