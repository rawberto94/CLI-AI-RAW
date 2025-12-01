/**
 * Contract Data Sync API
 * POST /api/contracts/sync - Sync all contract tracking data
 * 
 * This is a convenience endpoint that triggers sync for:
 * - Contract expirations
 * - Health scores
 * - Expiration alerts
 * 
 * Useful for scheduled jobs or manual refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || await getServerTenantId();
    const baseUrl = request.nextUrl.origin;
    
    const results = {
      expirations: { success: false, data: null as any, error: null as string | null },
      healthScores: { success: false, data: null as any, error: null as string | null },
      alerts: { success: false, data: null as any, error: null as string | null },
    };

    // 1. Sync expirations
    try {
      const expResponse = await fetch(`${baseUrl}/api/contracts/sync-expirations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const expResult = await expResponse.json();
      results.expirations = { 
        success: expResult.success, 
        data: expResult.data,
        error: expResult.error?.message || null,
      };
    } catch (error) {
      results.expirations.error = String(error);
    }

    // 2. Sync health scores
    try {
      const healthResponse = await fetch(`${baseUrl}/api/contracts/sync-health-scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const healthResult = await healthResponse.json();
      results.healthScores = { 
        success: healthResult.success, 
        data: healthResult.data,
        error: healthResult.error?.message || null,
      };
    } catch (error) {
      results.healthScores.error = String(error);
    }

    // 3. Generate pending alerts
    try {
      const alertResponse = await fetch(`${baseUrl}/api/contracts/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, action: 'generate-pending' }),
      });
      const alertResult = await alertResponse.json();
      results.alerts = { 
        success: alertResult.success, 
        data: alertResult.data,
        error: alertResult.error || null,
      };
    } catch (error) {
      results.alerts.error = String(error);
    }

    const allSuccess = results.expirations.success && 
                       results.healthScores.success && 
                       results.alerts.success;

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess 
        ? 'All contract data synced successfully' 
        : 'Some sync operations failed',
      data: {
        expirations: results.expirations,
        healthScores: results.healthScores,
        alerts: results.alerts,
        summary: {
          contractsWithExpirations: results.expirations.data?.synced || 0,
          contractsWithHealthScores: results.healthScores.data?.synced || 0,
          alertsGenerated: results.alerts.data?.created || 0,
        },
      },
      meta: {
        tenantId,
        timestamp: new Date().toISOString(),
        duration: `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    console.error('Contract sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync contract data', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    
    // Return sync status and last sync times
    // This could be enhanced to track actual last sync times in a separate table
    
    return NextResponse.json({
      success: true,
      data: {
        endpoints: {
          expirations: '/api/contracts/sync-expirations',
          healthScores: '/api/contracts/sync-health-scores',
          alerts: '/api/contracts/alerts (action: generate-pending)',
          fullSync: '/api/contracts/sync (POST)',
        },
        description: 'POST to /api/contracts/sync to trigger a full sync of all tracking data',
      },
      meta: {
        tenantId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
