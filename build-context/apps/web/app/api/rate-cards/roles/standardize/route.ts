/**
 * Role Standardization API
 * POST /api/rate-cards/roles/standardize
 * Standardizes a role name using AI
 */

import { NextRequest } from 'next/server';
import { roleStandardizationService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }
    
    const body = await request.json();

    const { roleOriginal, context } = body;

    if (!roleOriginal) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'roleOriginal is required', 400);
    }

    const result = await roleStandardizationService.standardizeRole(
      roleOriginal,
      tenantId,
      context
    );

    return createSuccessResponse(ctx, result);
  });
