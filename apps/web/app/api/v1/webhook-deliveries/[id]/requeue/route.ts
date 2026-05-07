/**
 * POST /api/v1/webhook-deliveries/[id]/requeue — manually requeue a dead
 * (DLQ) delivery for another retry pass.
 *
 * Scope: `webhooks:write`.
 *
 * Resets attempt counter, clears errors/deadAt, and schedules an immediate
 * retry by setting nextAttemptAt = now. The next /api/cron/webhook-retry
 * tick (or any subsequent attempt by the worker) will pick it up.
 */

import { NextResponse } from 'next/server';
import { authenticateApiToken, requireScope } from '@/lib/api/v1/auth';
import {
  enforceApiV1RateLimit,
  withRateLimitHeaders,
} from '@/lib/api/v1/rate-limit';
import { requeueDeadDelivery } from '@/lib/webhooks/delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.ok) return authResult.response;
  const { auth } = authResult;
  const scopeError = requireScope(auth, 'webhooks:write');
  if (scopeError) return scopeError;

  const { exceeded, result: rlResult } = await enforceApiV1RateLimit(auth);
  if (exceeded) return exceeded;

  const { id } = await params;
  const ok = await requeueDeadDelivery(id, auth.tenantId);
  if (!ok) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: 'Delivery not found or not in dead status' },
        { status: 404 },
      ),
      rlResult,
    );
  }

  return withRateLimitHeaders(
    NextResponse.json({ success: true, id, status: 'pending' }),
    rlResult,
  );
}
