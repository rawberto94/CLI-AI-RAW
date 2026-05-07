/**
 * GET /api/admin/webhook-deliveries
 *
 * Session-auth admin endpoint backing the /settings/webhook-deliveries page.
 * Lists `WebhookDelivery` rows for the caller's tenant with optional filters
 * (status, event, webhookId) plus aggregate counts by status. Cursor pagination
 * via row id (descending).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUS = new Set(['pending', 'success', 'failed', 'dead']);

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
  const status = searchParams.get('status') ?? undefined;
  const event = searchParams.get('event') ?? undefined;
  const webhookId = searchParams.get('webhookId') ?? undefined;
  const cursor = searchParams.get('cursor') ?? undefined;
  const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);

  if (status && !VALID_STATUS.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }

  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status;
  if (event) where.event = event;
  if (webhookId) where.webhookId = webhookId;

  const summaryWhere: Record<string, unknown> = { tenantId };
  if (event) summaryWhere.event = event;
  if (webhookId) summaryWhere.webhookId = webhookId;

  const [rows, counts] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        webhookId: true,
        event: true,
        status: true,
        attempt: true,
        maxAttempts: true,
        statusCode: true,
        error: true,
        deliveryId: true,
        createdAt: true,
        updatedAt: true,
        lastAttemptAt: true,
        nextAttemptAt: true,
        deadAt: true,
        sentAt: true,
      },
    }),
    prisma.webhookDelivery.groupBy({
      by: ['status'],
      where: summaryWhere,
      _count: { _all: true },
    }),
  ]);

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows.pop();
    nextCursor = last?.id ?? null;
  }

  const summary = { pending: 0, success: 0, failed: 0, dead: 0 } as Record<string, number>;
  for (const row of counts) {
    summary[row.status] = row._count._all;
  }

  return NextResponse.json({
    data: rows,
    summary,
    nextCursor,
    hasMore: nextCursor !== null,
  });
}
