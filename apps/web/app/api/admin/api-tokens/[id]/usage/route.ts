/**
 * GET /api/admin/api-tokens/:id/usage — per-token request volume timeseries.
 *
 * Session-auth (admin / owner). Returns hourly buckets for the requested
 * window so the API tokens UI can render last-24h / last-7d charts and a
 * lifetime request count.
 *
 * Query params:
 *   - hours (default 24, max 168): number of trailing hours to return.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminScope, isScopeError } from '@/lib/tenant-isolation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const scope = await requireAdminScope(request);
  if (isScopeError(scope)) {
    return scope;
  }
  const tenantId = scope.tenantId;

  const token = await prisma.apiToken.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      requestCount: true,
      createdAt: true,
    },
  });
  if (!token) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const hoursParam = parseInt(url.searchParams.get('hours') || '24', 10);
  const hours = Math.min(Math.max(hoursParam || 24, 1), 168);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const buckets = await prisma.apiTokenUsageBucket.findMany({
    where: { tokenId: id, hourBucket: { gte: since } },
    orderBy: { hourBucket: 'asc' },
    select: { hourBucket: true, count: true },
  });

  const totalInWindow = buckets.reduce((sum, b) => sum + b.count, 0);

  return NextResponse.json({
    data: {
      token,
      windowHours: hours,
      totalInWindow,
      buckets: buckets.map(b => ({
        hourBucket: b.hourBucket,
        count: b.count,
      })),
    },
  });
}
