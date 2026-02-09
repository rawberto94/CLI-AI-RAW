/**
 * Renewal Scan API - Trigger renewal alert worker
 * 
 * POST /api/renewals/scan - Trigger a renewal scan job
 * GET /api/renewals/scan - Get scan status
 */

import { NextRequest } from 'next/server';
import { getServerTenantId } from '@/lib/tenant-server';
import { optionalImport } from '@/lib/server/optional-module';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
export const dynamic = 'force-dynamic';

/**
 * POST /api/renewals/scan
 * Trigger a renewal check scan
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = await getServerTenantId();
  const body = await request.json().catch(() => ({}));

  const {
    daysAhead = 90,
    criticalThresholdDays = 14,
    warningThresholdDays = 30,
    autoRenewalOnly = false,
    priority = 'normal',
  } = body;

  const workerModule = await optionalImport<{ triggerRenewalCheck: (args: any) => Promise<any> }>(
    '@workspace/workers/renewal-alert-worker'
  );

  if (!workerModule?.triggerRenewalCheck) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Background worker not available', 503);
  }

  const { triggerRenewalCheck } = workerModule;

  const job = await triggerRenewalCheck({
    tenantId,
    daysAhead,
    criticalThresholdDays,
    warningThresholdDays,
    autoRenewalOnly,
    priority,
    source: 'manual',
  });

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Renewal scan triggered',
    jobId: job.id,
    options: {
      daysAhead,
      criticalThresholdDays,
      warningThresholdDays,
      autoRenewalOnly,
    },
  });
});

/**
 * GET /api/renewals/scan
 * Get information about renewal scanning
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const _tenantId = await getServerTenantId();

  return createSuccessResponse(ctx, {
    success: true,
    available: true,
    description: 'Renewal Alert Scanner',
    capabilities: {
      daysAhead: 'Number of days ahead to scan (default: 90)',
      criticalThresholdDays: 'Days for critical alert (default: 14)',
      warningThresholdDays: 'Days for warning alert (default: 30)',
      autoRenewalOnly: 'Only scan auto-renewal contracts (default: false)',
      priority: 'Job priority: high, normal, low (default: normal)',
    },
    scheduling: {
      default: 'Daily at 8 AM',
      cron: '0 8 * * *',
    },
  });
});
