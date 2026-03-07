/**
 * Obligation Scan API - Trigger obligation tracker worker
 * 
 * POST /api/deadlines/scan - Trigger an obligation scan job
 * GET /api/deadlines/scan - Get scan status
 */

import { NextRequest } from 'next/server';
import { getServerTenantId } from '@/lib/tenant-server';
import { optionalImport } from '@/lib/server/optional-module';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
export const dynamic = 'force-dynamic';

/**
 * POST /api/deadlines/scan
 * Trigger an obligation check scan
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await getServerTenantId();
  const body = await request.json().catch(() => ({}));

  const {
    daysAhead = 30,
    includeOverdue = true,
    obligationType = 'all',
    partyFilter,
    criticalThresholdDays = 3,
    warningThresholdDays = 7,
    priority = 'normal',
  } = body;

  const workerModule = await optionalImport<{ 
    triggerObligationCheck: (options: {
      tenantId: string;
      daysAhead: number;
      includeOverdue: boolean;
      obligationType: string;
      partyFilter: string | undefined;
      criticalThresholdDays: number;
      warningThresholdDays: number;
      priority: string;
      source: string;
    }) => Promise<{ id: string }> 
  }>(
    '@workspace/workers/obligation-tracker-worker'
  );

  if (!workerModule?.triggerObligationCheck) {
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Background worker not available', 503);
  }

  const { triggerObligationCheck } = workerModule;

  const job = await triggerObligationCheck({
    tenantId,
    daysAhead,
    includeOverdue,
    obligationType,
    partyFilter,
    criticalThresholdDays,
    warningThresholdDays,
    priority,
    source: 'manual',
  });

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Obligation scan triggered',
    jobId: job.id,
    options: {
      daysAhead,
      includeOverdue,
      obligationType,
      partyFilter,
      criticalThresholdDays,
      warningThresholdDays,
    },
  });
});

/**
 * GET /api/deadlines/scan
 * Get information about obligation scanning
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const _tenantId = await getServerTenantId();

  return createSuccessResponse(ctx, {
    success: true,
    available: true,
    description: 'Obligation Tracker Scanner',
    capabilities: {
      daysAhead: 'Number of days ahead to scan (default: 30)',
      includeOverdue: 'Include overdue obligations (default: true)',
      obligationType: 'Filter by type: deliverable, sla, milestone, reporting, compliance, all',
      partyFilter: 'Filter by party name',
      criticalThresholdDays: 'Days for critical alert (default: 3)',
      warningThresholdDays: 'Days for warning alert (default: 7)',
      priority: 'Job priority: high, normal, low (default: normal)',
    },
    scheduling: {
      default: 'Daily at 7 AM',
      cron: '0 7 * * *',
    },
  });
});
