/**
 * Renewal Alerts Cron Job
 * 
 * GET /api/cron/renewal-alerts - Scheduled daily renewal scan
 * 
 * This endpoint is called by a cron scheduler (Vercel Cron, Railway, etc.)
 * to trigger the renewal alert worker for all tenants.
 */

import { NextRequest, NextResponse } from 'next/server';
import { optionalImport } from '@/lib/server/optional-module';

export const dynamic = 'force-dynamic';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const daysAhead = parseInt(searchParams.get('daysAhead') || '90');

    const workerModule = await optionalImport<{ triggerRenewalCheck: (args: any) => Promise<any> }>(
      '@workspace/workers/renewal-alert-worker'
    );

    if (!workerModule?.triggerRenewalCheck) {
      return NextResponse.json(
        {
          success: false,
          error: 'Background worker not available',
          message: 'Renewal alert worker is not installed/configured in this environment.',
        },
        { status: 503 }
      );
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

    return NextResponse.json({
      success: true,
      message: 'Renewal alerts scan triggered',
      jobId: job.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to trigger renewal alerts' 
      },
      { status: 500 }
    );
  }
}
