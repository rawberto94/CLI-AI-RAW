/**
 * GET /api/v1/webhook-deliveries — outbound webhook delivery status.
 *
 * Scope: `webhooks:read`.
 *
 * Provides visibility into the persistent delivery queue: pending, success,
 * failed (retry pending), and dead (DLQ) rows. Combined with `/api/cron/webhook-retry`
 * and the requeue endpoint this gives full at-least-once delivery semantics.
 *
 * Query params:
 *   - status     — filter: pending | success | failed | dead
 *   - event      — filter by event type
 *   - webhookId  — filter by webhook config id
 *   - dispatchId — filter by one trigger/replay batch id
 *   - limit      — default 50, max 200
 *   - cursor     — opaque (delivery row id) for pagination
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateApiToken, requireScope } from '@/lib/api/v1/auth';
import {
  enforceApiV1RateLimit,
  withRateLimitHeaders,
} from '@/lib/api/v1/rate-limit';
import {
  getQueuedDeliveryWhere,
  getRetryingDeliveryWhere,
  toDisplayDeliveryStatus,
} from '@/lib/webhooks/status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const ALLOWED_STATUS = new Set(['pending', 'success', 'failed', 'dead']);

export async function GET(request: Request) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.ok) return authResult.response;
  const { auth } = authResult;
  const scopeError = requireScope(auth, 'webhooks:read');
  if (scopeError) return scopeError;

  const { exceeded, result: rlResult } = await enforceApiV1RateLimit(auth);
  if (exceeded) return exceeded;

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const status = url.searchParams.get('status') || undefined;
  const event = url.searchParams.get('event') || undefined;
  const webhookId = url.searchParams.get('webhookId') || undefined;
  const dispatchId = url.searchParams.get('dispatchId') || undefined;
  const cursor = url.searchParams.get('cursor') || undefined;

  if (status && !ALLOWED_STATUS.has(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${Array.from(ALLOWED_STATUS).join(', ')}` },
      { status: 400 },
    );
  }

  const where: Record<string, unknown> = { tenantId: auth.tenantId };
  if (status === 'failed') {
    where.OR = [{ status: 'failed' }, getRetryingDeliveryWhere()];
  } else if (status === 'pending') {
    Object.assign(where, getQueuedDeliveryWhere());
  } else if (status) {
    where.status = status;
  }
  if (event) where.event = event;
  if (webhookId) where.webhookId = webhookId;
  if (dispatchId) {
    where.payload = { path: ['dispatchId'], equals: dispatchId };
  }

  const rows = await prisma.webhookDelivery.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const data = page.map(r => ({
    id: r.id,
    webhookId: r.webhookId,
    event: r.event,
    status: toDisplayDeliveryStatus(r),
    attempt: r.attempt,
    maxAttempts: r.maxAttempts,
    statusCode: r.statusCode,
    error: r.error,
    deliveryId: r.deliveryId,
    dispatchId:
      r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload)
        ? ((r.payload as { dispatchId?: unknown }).dispatchId ?? null)
        : null,
    sentAt: r.sentAt,
    lastAttemptAt: r.lastAttemptAt,
    nextAttemptAt: r.nextAttemptAt,
    deadAt: r.deadAt,
    createdAt: r.createdAt,
  }));

  const nextCursor = data.length > 0 ? data[data.length - 1].id : null;

  return withRateLimitHeaders(
    NextResponse.json({ data, nextCursor, hasMore }),
    rlResult,
  );
}
