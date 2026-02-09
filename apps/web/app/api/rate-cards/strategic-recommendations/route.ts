import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from '@/lib/security/tenant';
import { strategicRecommendationsService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    // Generate strategic recommendations
    const recommendationsService = new strategicRecommendationsService(prisma);
    const recommendations = await recommendationsService.generateRecommendations(tenantId);

    // Also get portfolio analysis
    const portfolio = await recommendationsService.analyzePortfolio(tenantId);

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        recommendations,
        portfolio,
      },
    });
  });
