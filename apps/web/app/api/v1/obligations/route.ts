/**
 * GET /api/v1/obligations — list obligations across the caller's tenant.
 *
 * Scope: `obligations:read`. Filters: contractId, status, dueBefore,
 * updatedSince. Cursor pagination by id.
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
  const scopeError = requireScope(auth, 'obligations:read');
  if (scopeError) return scopeError;

  const { exceeded, result: rlResult } = await enforceApiV1RateLimit(auth);
  if (exceeded) return exceeded;

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const cursor = url.searchParams.get('cursor') || undefined;
  const contractId = url.searchParams.get('contractId') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const dueBeforeStr = url.searchParams.get('dueBefore') || undefined;
  const updatedSinceStr = url.searchParams.get('updatedSince') || undefined;

  const where: Record<string, unknown> = { tenantId: auth.tenantId };
  if (contractId) where.contractId = contractId;
  if (status) where.status = status;
  if (dueBeforeStr) {
    const d = new Date(dueBeforeStr);
    if (!isNaN(d.getTime())) where.dueDate = { lte: d };
  }
  if (updatedSinceStr) {
    const d = new Date(updatedSinceStr);
    if (!isNaN(d.getTime())) where.updatedAt = { gte: d };
  }

  const rows = await prisma.obligation.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return withRateLimitHeaders(
    NextResponse.json({ data: page, nextCursor, hasMore }),
    rlResult,
  );
}
