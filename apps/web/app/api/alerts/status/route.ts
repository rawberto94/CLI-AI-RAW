import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { redis } from '@/lib/redis';

// GET /api/alerts/status
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'manager') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin or manager access required', 403);
  }

  const lastRun = await redis.get(`alerts:last-run:${ctx.tenantId}`);
  const renewalCount = await redis.keys(`alert:renewal:${ctx.tenantId}:*`).then(k => k.length);
  const obligationCount = await redis.keys(`alert:obligation:${ctx.tenantId}:*`).then(k => k.length);

  return createSuccessResponse(ctx, {
    lastRun: lastRun || null,
    notificationsSent: {
      renewals: renewalCount,
      obligations: obligationCount,
    },
  });
});
