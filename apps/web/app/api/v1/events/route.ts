/**
 * GET /api/v1/events — durable event stream for outbound consumers.
 *
 * Scope: `events:read`. Cursor pagination by monotonic id.
 *
 * Query params:
 *   - since (id, exclusive)        — start after this event id
 *   - limit (default 100, max 500) — max rows per response
 *   - eventType                    — exact match filter
 *   - resourceId                   — exact match filter
 *
 * Response:
 *   { data: Event[], nextSince: string|null, hasMore: boolean }
 *
 * `nextSince` is the id of the last row in the current page. Pass it
 * back as `?since=...` to continue. Polling pattern:
 *
 *   while true:
 *     resp = GET /api/v1/events?since=$cursor
 *     persist(resp.data)
 *     cursor = resp.nextSince || cursor
 *     sleep if !resp.hasMore
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateApiToken, requireScope } from '@/lib/api/v1/auth';
import {
  enforceApiV1RateLimit,
  withRateLimitHeaders,
} from '@/lib/api/v1/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

export async function GET(request: Request) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.ok) return authResult.response;
  const { auth } = authResult;
  const scopeError = requireScope(auth, 'events:read');
  if (scopeError) return scopeError;

  const { exceeded, result: rlResult } = await enforceApiV1RateLimit(auth);
  if (exceeded) return exceeded;

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const sinceStr = url.searchParams.get('since') || undefined;
  const eventType = url.searchParams.get('eventType') || undefined;
  const resourceId = url.searchParams.get('resourceId') || undefined;

  let since: bigint | undefined;
  if (sinceStr) {
    try {
      since = BigInt(sinceStr);
    } catch {
      return NextResponse.json(
        { error: 'since must be an integer event id' },
        { status: 400 },
      );
    }
  }

  const where: Record<string, unknown> = { tenantId: auth.tenantId };
  if (since !== undefined) where.id = { gt: since };
  if (eventType) where.eventType = eventType;
  if (resourceId) where.resourceId = resourceId;

  const rows = await prisma.integrationEvent.findMany({
    where,
    orderBy: { id: 'asc' },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Serialize BigInt ids as strings for JSON safety.
  const data = page.map(r => ({
    id: r.id.toString(),
    tenantId: r.tenantId,
    eventType: r.eventType,
    resourceId: r.resourceId,
    payload: r.payload,
    createdAt: r.createdAt,
  }));

  const nextSince = data.length > 0 ? data[data.length - 1].id : null;

  return withRateLimitHeaders(
    NextResponse.json({ data, nextSince, hasMore }),
    rlResult,
  );
}
