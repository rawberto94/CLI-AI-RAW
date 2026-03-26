import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardEntryService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

const rateCardService = new rateCardEntryService(prisma);

/**
 * GET /api/rate-cards/suggestions/suppliers
 * Get supplier suggestions based on partial input
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = Math.min(Math.max(1, searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10), 200);

    if (!query || query.length < 2) {
      return createSuccessResponse(ctx, [])
    }

    const suggestions = await rateCardService.getSupplierSuggestions(query, tenantId, limit);

    return createSuccessResponse(ctx, suggestions);
  });
