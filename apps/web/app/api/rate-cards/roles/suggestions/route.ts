/**
 * Role Suggestions API
 * GET /api/rate-cards/roles/suggestions
 * Returns role name suggestions for autocomplete
 */

import { NextRequest } from 'next/server';
import { roleStandardizationService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    if (query.length < 2) {
      return createSuccessResponse(ctx, { suggestions: [] });
    }

    const suggestions = await roleStandardizationService.getRoleSuggestions(
      query,
      tenantId,
      10
    );

    return createSuccessResponse(ctx, { suggestions });
  });
