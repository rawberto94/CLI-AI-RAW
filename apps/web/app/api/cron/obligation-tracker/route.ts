/**
 * Obligation Tracker Cron Job
 * 
 * GET /api/cron/obligation-tracker - Scheduled daily obligation scan
 * 
 * This endpoint is called by a cron scheduler (Vercel Cron, Railway, etc.)
 * to trigger the obligation tracker worker for all tenants.
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
    const daysAhead = parseInt(searchParams.get('daysAhead') || '30');
    const includeOverdue = searchParams.get('includeOverdue') !== 'false';

    console.log('[CRON] Starting obligation tracker scan', { tenantId, daysAhead, includeOverdue });

    // Dynamic import to avoid build issues
    const { triggerObligationCheck } = await import('@workspace/workers/obligation-tracker-worker');

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

    console.log('[CRON] Obligation tracker job queued', { jobId: job.id });

    return NextResponse.json({
      success: true,
      message: 'Obligation tracker scan triggered',
      jobId: job.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Failed to trigger obligation tracker:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to trigger obligation tracker' 
      },
      { status: 500 }
    );
  }
}
