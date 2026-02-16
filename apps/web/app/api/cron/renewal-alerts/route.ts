/**
 * Renewal Alerts Cron Job
 * 
 * GET /api/cron/renewal-alerts - Scheduled daily renewal scan
 * 
 * This endpoint is called by a cron scheduler (Vercel Cron, Railway, etc.)
 * to trigger the renewal alert worker for all tenants.
 */

import { NextRequest } from 'next/server';
import { withCronHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';
import { optionalImport } from '@/lib/server/optional-module';

export const dynamic = 'force-dynamic';

export const GET = withCronHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const daysAhead = parseInt(searchParams.get('daysAhead') || '90');

    const workerModule = await optionalImport<{ triggerRenewalCheck: (args: any) => Promise<any> }>(
      '@workspace/workers/renewal-alert-worker'
    );

    if (!workerModule?.triggerRenewalCheck) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Renewal alert worker is not installed/configured in this environment.', 503);
    }

    const { triggerRenewalCheck } = workerModule;

    const job = await triggerRenewalCheck({
      tenantId,
      daysAhead,
      criticalThresholdDays: 14,
      warningThresholdDays: 30,
      priority: 'normal',
      source: 'scheduled',
    });

    return createSuccessResponse(ctx, {
      message: 'Renewal alerts scan triggered',
      jobId: job.id,
      timestamp: new Date().toISOString(),
    });
});
