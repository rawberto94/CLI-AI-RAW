/**
 * Share Filter API
 * 
 * Toggle sharing status of a saved filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

/**
 * POST /api/rate-cards/filters/[id]/share
 * Toggle sharing status of a saved filter
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const filterId = params.id;

    // Verify ownership
    const filter = await prisma.$queryRaw<any[]>`
      SELECT * FROM "rate_card_filter_presets"
      WHERE "id" = ${filterId} AND "userId" = ${ctx.userId}
    `;

    if (filter.length === 0) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Filter not found', 404);
    }

    // Toggle share status
    const updatedFilter = await prisma.$queryRaw<any>`
      UPDATE "rate_card_filter_presets"
      SET
        "isShared" = NOT "isShared",
        "updatedAt" = NOW()
      WHERE "id" = ${filterId}
      RETURNING *
    `;

    return createSuccessResponse(ctx, { filter: updatedFilter[0] });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update filter share status', 500);
  }
}
