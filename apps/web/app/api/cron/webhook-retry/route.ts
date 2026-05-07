/**
 * Webhook retry cron — drains pending WebhookDelivery rows whose
 * `nextAttemptAt` has elapsed and runs the next attempt.
 *
 * Runs idempotently: any delivery already in `success` or `dead`
 * status is ignored. Picks up to 50 rows per invocation.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 */

import { NextRequest } from 'next/server';
import { withCronHandler, createSuccessResponse } from '@/lib/api-middleware';
import { runDueRetries } from '@/lib/webhooks/delivery';

export const POST = withCronHandler(async (_request: NextRequest, ctx) => {
  const summary = await runDueRetries();
  return createSuccessResponse(ctx, {
    success: true,
    ...summary,
  });
});

// Allow GET for simpler scheduler integrations (Vercel Cron, etc.)
export const GET = POST;
