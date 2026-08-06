/**
 * GET /api/analytics/ux-metrics
 * Aggregates the six agentic UX success metrics for the admin dashboard.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const METRIC_EVENTS = [
  'approval_requested',
  'approval_decided',
  'notification_impression',
  'notification_click',
  'agent_undo_used',
  'autonomy_changed',
] as const;

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const days = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30, 1),
    365,
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const events = await prisma.analyticsEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: since },
        event: { in: [...METRIC_EVENTS] },
      },
      select: {
        event: true,
        props: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const counts: Record<string, number> = Object.fromEntries(
      METRIC_EVENTS.map((e) => [e, 0]),
    );
    let latencySum = 0;
    let latencyCount = 0;
    let evidenceViewedCount = 0;
    let decidedCount = 0;
    const byDay: Record<string, Record<string, number>> = {};

    for (const row of events) {
      counts[row.event] = (counts[row.event] || 0) + 1;
      const day = row.createdAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = {};
      byDay[day][row.event] = (byDay[day][row.event] || 0) + 1;

      if (row.event === 'approval_decided') {
        decidedCount += 1;
        const props = (row.props ?? {}) as Record<string, unknown>;
        if (typeof props.latencyMs === 'number' && Number.isFinite(props.latencyMs)) {
          latencySum += props.latencyMs;
          latencyCount += 1;
        }
        if (props.evidence_viewed === true) evidenceViewedCount += 1;
      }
    }

    const requested = counts.approval_requested || 0;
    const decided = counts.approval_decided || 0;

    return createSuccessResponse(ctx, {
      periodDays: days,
      since: since.toISOString(),
      metrics: {
        approval_requested: counts.approval_requested,
        approval_decided: counts.approval_decided,
        notification_impression: counts.notification_impression,
        notification_click: counts.notification_click,
        agent_undo_used: counts.agent_undo_used,
        autonomy_changed: counts.autonomy_changed,
        approval_decision_rate: requested > 0 ? decided / requested : null,
        avg_approval_latency_ms: latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
        evidence_viewed_rate:
          decidedCount > 0 ? evidenceViewedCount / decidedCount : null,
      },
      series: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, eventsForDay]) => ({ date, ...eventsForDay })),
      totalEvents: events.length,
    });
  } catch (error) {
    logger.error('Failed to load UX metrics:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to load UX metrics', 500);
  }
});
