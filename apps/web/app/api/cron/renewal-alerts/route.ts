/**
 * Renewal Alerts Cron Job
 * 
 * GET /api/cron/renewal-alerts - Scheduled daily renewal scan
 * 
 * This endpoint is called by a cron scheduler (Vercel Cron, Railway, etc.)
 * to trigger the renewal alert worker for all tenants.
 */

import { NextRequest, NextResponse } from 'next/server';

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

    console.log('[CRON] Starting renewal alerts scan', { tenantId, daysAhead });

    // Dynamic import to avoid build issues
    const { triggerRenewalCheck } = await import('@workspace/workers/renewal-alert-worker');

    const job = await triggerRenewalCheck({
      tenantId,
      daysAhead,
      criticalThresholdDays: 14,
      warningThresholdDays: 30,
      priority: 'normal',
      source: 'scheduled',
    });

    console.log('[CRON] Renewal alerts job queued', { jobId: job.id });

    return NextResponse.json({
      success: true,
      message: 'Renewal alerts scan triggered',
      jobId: job.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Failed to trigger renewal alerts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to trigger renewal alerts' 
      },
      { status: 500 }
    );
  }
}
