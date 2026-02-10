import { NextRequest } from 'next/server';
import { AdvancedFilterService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

const advancedFilterService = new AdvancedFilterService(prisma);

/**
 * POST /api/rate-cards/filter/validate
 * Validate an advanced filter and get match count
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const body = await request.json();
    const filter = body.filter;

    if (!filter) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Filter is required', 400);
    }

    // Validate filter structure
    const validation = advancedFilterService.validateFilter(filter);

    if (!validation.valid) {
      return createSuccessResponse(ctx, {
        valid: false,
        errors: validation.errors,
      });
    }

    // Calculate match count
    const matchCount = await advancedFilterService.calculateMatchCount(
      tenantId,
      filter
    );

    // Get filter summary
    const summary = advancedFilterService.getFilterSummary(filter);

    return createSuccessResponse(ctx, {
      valid: true,
      errors: [],
      matchCount: matchCount.count,
      executionTime: matchCount.executionTime,
      summary,
    });
  });
