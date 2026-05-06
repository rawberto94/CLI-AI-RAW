/**
 * Obligation Tracker Cron Job
 * 
 * GET /api/cron/obligation-tracker - Scheduled daily obligation scan
 * 
 * This endpoint is called by a cron scheduler (Vercel Cron, Railway, etc.)
 * to trigger the obligation tracker worker for all tenants.
 */

import { NextRequest } from 'next/server';
import { withCronHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';
import { optionalImport } from '@/lib/server/optional-module';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = withCronHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const daysAhead = parseInt(searchParams.get('daysAhead') || '30');
    const includeOverdue = searchParams.get('includeOverdue') !== 'false';

    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });

      if (!tenant) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
      }
    }

    const workerModule = await optionalImport<{ triggerObligationCheck: (args: any) => Promise<any> }>(
      '@workspace/workers/obligation-tracker-worker'
    );

    if (!workerModule?.triggerObligationCheck) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Obligation tracker worker is not installed/configured in this environment.', 503);
    }

    const { triggerObligationCheck } = workerModule;

    const job = await triggerObligationCheck({
      tenantId,
      daysAhead,
      includeOverdue,
      obligationType: 'all',
      criticalThresholdDays: 3,
      warningThresholdDays: 7,
      priority: 'normal',
      source: 'scheduled',
    });

    return createSuccessResponse(ctx, {
      message: 'Obligation tracker scan triggered',
      jobId: job.id,
      timestamp: new Date().toISOString(),
    });
});
