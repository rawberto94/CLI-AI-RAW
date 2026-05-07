/**
 * GET /api/admin/integration-events
 *
 * Session-auth admin endpoint backing the /settings/integration-events page.
 * Lists durable IntegrationEvent rows for the caller's tenant with optional
 * filters (eventType, resourceId) and reverse cursor pagination by id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get('eventType')?.trim() || undefined;
  const resourceId = searchParams.get('resourceId')?.trim() || undefined;
  const cursorStr = searchParams.get('cursor')?.trim() || undefined;
  const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
  const limit = Math.min(Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT, MAX_LIMIT);

  let cursorId: bigint | undefined;
  if (cursorStr) {
    try {
      cursorId = BigInt(cursorStr);
    } catch {
      return NextResponse.json({ error: 'cursor must be an integer event id' }, { status: 400 });
    }
  }

  const where: Record<string, unknown> = { tenantId };
  if (eventType) where.eventType = eventType;
  if (resourceId) where.resourceId = resourceId;
  if (cursorId !== undefined) where.id = { lt: cursorId };

  const rows = await prisma.integrationEvent.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const data = page.map((row) => ({
    id: row.id.toString(),
    tenantId: row.tenantId,
    eventType: row.eventType,
    resourceId: row.resourceId,
    payload: row.payload,
    createdAt: row.createdAt,
  }));
  const nextCursor = data.length > 0 ? data[data.length - 1].id : null;

  return NextResponse.json({ data, nextCursor, hasMore });
}