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

import { NextRequest } from 'next/server';
import { getServerTenantId } from '@/lib/tenant-server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const POST = withAuthApiHandler(async (request, ctx) => {
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

    return createSuccessResponse(ctx, {
      allSuccess,
      message: allSuccess 
        ? 'All contract data synced successfully' 
        : 'Some sync operations failed',
      expirations: results.expirations,
      healthScores: results.healthScores,
      alerts: results.alerts,
      summary: {
        contractsWithExpirations: results.expirations.data?.synced || 0,
        contractsWithHealthScores: results.healthScores.data?.synced || 0,
        alertsGenerated: results.alerts.data?.created || 0,
      },
      tenantId,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to sync contract data', 500);
  }
});

export const GET = withAuthApiHandler(async (_request, ctx) => {
  const tenantId = await getServerTenantId();
  
  // Return sync status and last sync times
  // This could be enhanced to track actual last sync times in a separate table
  
  return createSuccessResponse(ctx, {
    endpoints: {
      expirations: '/api/contracts/sync-expirations',
      healthScores: '/api/contracts/sync-health-scores',
      alerts: '/api/contracts/alerts (action: generate-pending)',
      fullSync: '/api/contracts/sync (POST)',
    },
    description: 'POST to /api/contracts/sync to trigger a full sync of all tracking data',
  });
});
