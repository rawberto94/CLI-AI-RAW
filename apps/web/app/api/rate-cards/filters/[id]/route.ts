/**
 * Individual Saved Filter API
 * 
 * Manage individual saved filter presets
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

/**
 * DELETE /api/rate-cards/filters/[id]
 * Delete a saved filter
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    await prisma.$executeRaw`
      DELETE FROM "rate_card_filter_presets"
      WHERE "id" = ${filterId}
    `;

    return createSuccessResponse(ctx, { success: true });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete saved filter', 500);
  }
}

/**
 * PATCH /api/rate-cards/filters/[id]
 * Update a saved filter
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const filterId = params.id;
    const body = await request.json();
    const { name, description, filters } = body;

    // Verify ownership
    const existingFilter = await prisma.$queryRaw<any[]>`
      SELECT * FROM "rate_card_filter_presets"
      WHERE "id" = ${filterId} AND "userId" = ${ctx.userId}
    `;

    if (existingFilter.length === 0) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Filter not found', 404);
    }

    const updatedFilter = await prisma.$queryRaw<any>`
      UPDATE "rate_card_filter_presets"
      SET
        "name" = COALESCE(${name}, "name"),
        "description" = COALESCE(${description}, "description"),
        "filters" = COALESCE(${filters ? JSON.stringify(filters) : null}::jsonb, "filters"),
        "updatedAt" = NOW()
      WHERE "id" = ${filterId}
      RETURNING *
    `;

    return createSuccessResponse(ctx, { filter: updatedFilter[0] });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update saved filter', 500);
  }
}
