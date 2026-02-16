/**
 * Saved Filters API
 * 
 * Manage saved filter presets
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

/**
 * GET /api/rate-cards/filters
 * Get all saved filters for the user
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
    // Get user's own filters and shared filters
    const filters = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM "rate_card_filter_presets"
      WHERE "tenantId" = ${ctx.tenantId}
        AND ("userId" = ${ctx.userId} OR "isShared" = true)
      ORDER BY "updatedAt" DESC
    `;

    return createSuccessResponse(ctx, { filters });
  });

/**
 * POST /api/rate-cards/filters
 * Create a new saved filter
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    if (!ctx.userId || !ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await request.json();
    const { name, description, filters } = body;

    if (!name || !filters) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Name and filters are required', 400);
    }

    const savedFilter = await prisma.$queryRaw<any>`
      INSERT INTO "rate_card_filter_presets" (
        "id",
        "tenantId",
        "userId",
        "name",
        "description",
        "filters",
        "isShared",
        "createdAt",
        "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${ctx.tenantId},
        ${ctx.userId},
        ${name},
        ${description || null},
        ${JSON.stringify(filters)}::jsonb,
        false,
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    return createSuccessResponse(ctx, { filter: savedFilter[0] });
  });
