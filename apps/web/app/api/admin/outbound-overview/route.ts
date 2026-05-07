import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [webhookTotal, webhookActive, deliveryCounts, tokenActive, requestAggregate, eventCount, eventAggregate] = await Promise.all([
    prisma.webhookConfig.count({ where: { tenantId } }),
    prisma.webhookConfig.count({ where: { tenantId, isActive: true } }),
    prisma.webhookDelivery.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.apiToken.count({ where: { tenantId, revokedAt: null } }),
    prisma.apiTokenUsageBucket.aggregate({
      where: { tenantId, hourBucket: { gte: since } },
      _sum: { count: true },
    }),
    prisma.integrationEvent.count({ where: { tenantId, createdAt: { gte: since } } }),
    prisma.integrationEvent.aggregate({
      where: { tenantId },
      _max: { createdAt: true },
    }),
  ]);

  const deliveries = { pending: 0, success: 0, failed: 0, dead: 0 } as Record<string, number>;
  for (const row of deliveryCounts) {
    deliveries[row.status] = row._count._all;
  }

  return NextResponse.json({
    data: {
      webhooks: {
        total: webhookTotal,
        active: webhookActive,
      },
      deliveries,
      apiTokens: {
        active: tokenActive,
        requestsLast24h: requestAggregate._sum.count ?? 0,
      },
      events: {
        last24h: eventCount,
        lastAt: eventAggregate._max.createdAt,
      },
    },
  });
}