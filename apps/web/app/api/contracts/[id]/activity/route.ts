import { NextRequest } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/:id/activity
 * Get activity feed for a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const tenantId = await getApiTenantId(request);

    try {
      const db = await getDb();
      
      // Fetch activities from database
      const activities = await db.contractActivity.findMany({
        where: {
          contractId,
          tenantId
        },
        orderBy: { timestamp: 'desc' },
        take: 50 // Limit to recent 50 activities
      });

      // Transform to frontend format
      const formattedActivities = activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        user: activity.userId || 'System',
        action: activity.action,
        details: activity.details,
        timestamp: activity.timestamp.toISOString(),
        metadata: activity.metadata
      }));

      return createSuccessResponse(ctx, {
        success: true,
        activities: formattedActivities,
        source: 'database'
      });

    } catch (error) {
      return handleApiError(ctx, error);
    }

  } catch (error) {
    return handleApiError(ctx, error);
  }
}
