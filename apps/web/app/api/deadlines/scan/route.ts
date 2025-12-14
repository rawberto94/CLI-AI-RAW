/**
 * Obligation Scan API - Trigger obligation tracker worker
 * 
 * POST /api/deadlines/scan - Trigger an obligation scan job
 * GET /api/deadlines/scan - Get scan status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerTenantId } from '@/lib/tenant-server';
import { optionalImport } from '@/lib/server/optional-module';

export const dynamic = 'force-dynamic';

/**
 * POST /api/deadlines/scan
 * Trigger an obligation check scan
 */
export async function POST(request: NextRequest) {
  try {
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

    const workerModule = await optionalImport<{ triggerObligationCheck: (tenantId: string) => Promise<unknown> }>(
      '@workspace/workers/obligation-tracker-worker'
    );

    if (!workerModule?.triggerObligationCheck) {
      return NextResponse.json(
        {
          success: false,
          error: 'Background worker not available',
          message: 'Obligation tracker worker is not installed/configured in this environment.',
        },
        { status: 503 }
      );
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

    return NextResponse.json({
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
  } catch (error) {
    console.error('Failed to trigger obligation scan:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to trigger obligation scan' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deadlines/scan
 * Get information about obligation scanning
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();

    return NextResponse.json({
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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get scan info' },
      { status: 500 }
    );
  }
}
