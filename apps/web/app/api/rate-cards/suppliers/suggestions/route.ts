/**
 * Supplier Suggestions API
 * GET /api/rate-cards/suppliers/suggestions
 * Returns supplier name suggestions for autocomplete
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return createSuccessResponse(ctx, { suggestions: [] });
    }

    const suppliers = await prisma.rateCardSupplier.findMany({
      where: {
        tenantId,
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        name: true,
      },
      distinct: ['name'],
      take: 10,
      orderBy: {
        name: 'asc',
      },
    });

    const suggestions = suppliers.map((s: { name: string }) => s.name);

    return createSuccessResponse(ctx, { suggestions });
  });
