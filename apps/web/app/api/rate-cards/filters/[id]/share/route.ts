/**
 * Share Filter API
 * 
 * Toggle sharing status of a saved filter
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

/**
 * POST /api/rate-cards/filters/[id]/share
 * Toggle sharing status of a saved filter
 */
export const POST = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const { id: filterId } = await (ctx as any).params as { id: string };

  try {

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
});
