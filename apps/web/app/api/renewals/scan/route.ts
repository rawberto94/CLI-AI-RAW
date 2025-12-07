/**
 * Renewal Scan API - Trigger renewal alert worker
 * 
 * POST /api/renewals/scan - Trigger a renewal scan job
 * GET /api/renewals/scan - Get scan status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/renewals/scan
 * Trigger a renewal check scan
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const body = await request.json().catch(() => ({}));

    const {
      daysAhead = 90,
      criticalThresholdDays = 14,
      warningThresholdDays = 30,
      autoRenewalOnly = false,
      priority = 'normal',
    } = body;

    // Dynamic import to avoid build issues
    const { triggerRenewalCheck } = await import('@workspace/workers/renewal-alert-worker');

    const job = await triggerRenewalCheck({
      tenantId,
      daysAhead,
      criticalThresholdDays,
      warningThresholdDays,
      autoRenewalOnly,
      priority,
      source: 'manual',
    });

    return NextResponse.json({
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
  } catch (error) {
    console.error('Failed to trigger renewal scan:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to trigger renewal scan' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/renewals/scan
 * Get information about renewal scanning
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();

    return NextResponse.json({
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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get scan info' },
      { status: 500 }
    );
  }
}
