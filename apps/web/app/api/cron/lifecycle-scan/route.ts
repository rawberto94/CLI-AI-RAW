/**
 * Lifecycle scan cron — emits obligation.overdue and contract.expired
 * events for rows that have crossed their threshold since the last run.
 *
 * Runs idempotently: an obligation/contract that is *already* in the
 * terminal status is skipped, so re-running this endpoint is safe and
 * cheap. Only the row(s) that flip on this pass produce events.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (handled by
 * `withCronHandler`).
 *
 * Query params:
 *   - tenantId (optional): scope the scan to a single tenant.
 *   - dryRun (optional, "1" | "true"): report what *would* be flipped
 *     without writing or emitting events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCronHandler, createSuccessResponse } from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScanResult {
  obligationsOverdue: number;
  contractsExpired: number;
  tenantsScanned: number;
  dryRun: boolean;
  durationMs: number;
}

export const GET = withCronHandler(
  async (request: NextRequest, ctx): Promise<NextResponse> => {
    const url = new URL(request.url);
    const scopedTenantId = url.searchParams.get('tenantId') || undefined;
    const dryRun =
      url.searchParams.get('dryRun') === '1' ||
      url.searchParams.get('dryRun') === 'true';
    const startedAt = Date.now();
    const now = new Date();

    const tenantFilter = scopedTenantId ? { tenantId: scopedTenantId } : {};

    // ---- Obligations: PENDING|IN_PROGRESS with dueDate < now → OVERDUE ----
    const overdueRows = await prisma.obligation.findMany({
      where: {
        ...tenantFilter,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: now, not: null },
      },
      select: {
        id: true,
        tenantId: true,
        contractId: true,
        title: true,
        dueDate: true,
        priority: true,
      },
    });

    if (!dryRun && overdueRows.length > 0) {
      await prisma.obligation.updateMany({
        where: { id: { in: overdueRows.map((o) => o.id) } },
        data: { status: 'OVERDUE' },
      });

      // Fire webhook + durable event for each newly-overdue obligation.
      const [{ triggerWebhook }, { recordIntegrationEvent }] = await Promise.all([
        import('@/lib/webhook-triggers'),
        import('@/lib/events/integration-events'),
      ]);
      for (const row of overdueRows) {
        const payload = {
          obligationId: row.id,
          contractId: row.contractId,
          title: row.title,
          dueDate: row.dueDate,
          priority: row.priority,
          daysOverdue: row.dueDate
            ? Math.floor((now.getTime() - row.dueDate.getTime()) / 86_400_000)
            : null,
        };
        triggerWebhook({
          tenantId: row.tenantId,
          event: 'obligation.overdue',
          data: payload,
        }).catch(() => {});
        recordIntegrationEvent({
          tenantId: row.tenantId,
          eventType: 'obligation.overdue',
          resourceId: row.id,
          payload,
        }).catch(() => {});
      }
    }

    // ---- Contracts: status != EXPIRED with expirationDate < now → EXPIRED ----
    const expiredRows = await prisma.contract.findMany({
      where: {
        ...tenantFilter,
        expirationDate: { lt: now, not: null },
        status: { notIn: ['EXPIRED', 'CANCELLED', 'ARCHIVED'] },
      },
      select: {
        id: true,
        tenantId: true,
        fileName: true,
        contractTitle: true,
        contractType: true,
        expirationDate: true,
        clientName: true,
        supplierName: true,
      },
    });

    if (!dryRun && expiredRows.length > 0) {
      await prisma.contract.updateMany({
        where: { id: { in: expiredRows.map((c) => c.id) } },
        data: { status: 'EXPIRED' },
      });

      const { recordIntegrationEvent } = await import(
        '@/lib/events/integration-events'
      );
      const { triggerWebhook } = await import('@/lib/webhook-triggers');
      for (const row of expiredRows) {
        const payload = {
          contractId: row.id,
          fileName: row.fileName,
          contractTitle: row.contractTitle,
          contractType: row.contractType,
          expirationDate: row.expirationDate,
          clientName: row.clientName,
          supplierName: row.supplierName,
        };
        triggerWebhook({
          tenantId: row.tenantId,
          event: 'contract.expired',
          data: payload,
        }).catch(() => {});
        recordIntegrationEvent({
          tenantId: row.tenantId,
          eventType: 'contract.expired',
          resourceId: row.id,
          payload,
        }).catch(() => {});
      }
    }

    const tenantSet = new Set<string>();
    overdueRows.forEach((r) => tenantSet.add(r.tenantId));
    expiredRows.forEach((r) => tenantSet.add(r.tenantId));

    const result: ScanResult = {
      obligationsOverdue: overdueRows.length,
      contractsExpired: expiredRows.length,
      tenantsScanned: tenantSet.size,
      dryRun,
      durationMs: Date.now() - startedAt,
    };

    return createSuccessResponse(ctx, result);
  },
);
