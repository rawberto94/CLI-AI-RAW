/**
 * Retention cleanup cron — prunes outbound integration tables to keep
 * append-only growth bounded.
 *
 * Targets:
 *   - IntegrationEvent       — older than EVENT_RETENTION_DAYS (default 90)
 *   - ApiTokenUsageBucket    — older than USAGE_RETENTION_DAYS (default 30)
 *   - WebhookDelivery        — terminal (success / dead) older than
 *                              DELIVERY_RETENTION_DAYS (default 30).
 *                              Pending rows are NEVER deleted.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (handled by withCronHandler).
 *
 * Query params:
 *   - dryRun=1 — count what would be deleted without deleting.
 *   - eventDays / usageDays / deliveryDays — per-target overrides (integers).
 */

import { NextRequest } from 'next/server';
import { withCronHandler, createSuccessResponse } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_EVENT_DAYS = parseInt(process.env.EVENT_RETENTION_DAYS || '90', 10);
const DEFAULT_USAGE_DAYS = parseInt(process.env.USAGE_RETENTION_DAYS || '30', 10);
const DEFAULT_DELIVERY_DAYS = parseInt(process.env.DELIVERY_RETENTION_DAYS || '30', 10);

function dayCutoff(days: number): Date {
  return new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
}

async function getPrisma() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

export const POST = withCronHandler(async (request: NextRequest, ctx) => {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true';
  const eventDays = parseInt(url.searchParams.get('eventDays') || '', 10) || DEFAULT_EVENT_DAYS;
  const usageDays = parseInt(url.searchParams.get('usageDays') || '', 10) || DEFAULT_USAGE_DAYS;
  const deliveryDays = parseInt(url.searchParams.get('deliveryDays') || '', 10) || DEFAULT_DELIVERY_DAYS;

  const prisma = await getPrisma();

  const eventCutoff = dayCutoff(eventDays);
  const usageCutoff = dayCutoff(usageDays);
  const deliveryCutoff = dayCutoff(deliveryDays);

  // Count first; for dryRun we stop after the count step.
  const [eventCandidates, usageCandidates, deliveryCandidates] = await Promise.all([
    prisma.integrationEvent.count({ where: { createdAt: { lt: eventCutoff } } }),
    prisma.apiTokenUsageBucket.count({ where: { hourBucket: { lt: usageCutoff } } }),
    prisma.webhookDelivery.count({
      where: {
        status: { in: ['success', 'dead'] },
        updatedAt: { lt: deliveryCutoff },
      },
    }),
  ]);

  if (dryRun) {
    return createSuccessResponse(ctx, {
      success: true,
      dryRun: true,
      windows: { eventDays, usageDays, deliveryDays },
      wouldDelete: {
        integrationEvents: eventCandidates,
        apiTokenUsageBuckets: usageCandidates,
        webhookDeliveries: deliveryCandidates,
      },
    });
  }

  const [eventResult, usageResult, deliveryResult] = await Promise.all([
    prisma.integrationEvent.deleteMany({ where: { createdAt: { lt: eventCutoff } } }),
    prisma.apiTokenUsageBucket.deleteMany({ where: { hourBucket: { lt: usageCutoff } } }),
    prisma.webhookDelivery.deleteMany({
      where: {
        status: { in: ['success', 'dead'] },
        updatedAt: { lt: deliveryCutoff },
      },
    }),
  ]);

  return createSuccessResponse(ctx, {
    success: true,
    windows: { eventDays, usageDays, deliveryDays },
    deleted: {
      integrationEvents: eventResult.count,
      apiTokenUsageBuckets: usageResult.count,
      webhookDeliveries: deliveryResult.count,
    },
  });
});

// Allow GET for simpler scheduler integrations (Vercel Cron, etc.)
export const GET = POST;
