import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { dataQualityScorerService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

export const GET = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const tenantId = await getApiTenantId(request);
    const minScore = searchParams.get('minScore');
    const maxScore = searchParams.get('maxScore');

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const qualityService = new dataQualityScorerService(prisma);
    const report = await qualityService.generateQualityReport(tenantId);

    // Filter by score if provided
    let lowQualityRateCards = report.lowQualityRateCards;
    if (minScore || maxScore) {
      lowQualityRateCards = lowQualityRateCards.filter(rc => {
        if (minScore && rc.score < parseFloat(minScore)) return false;
        if (maxScore && rc.score > parseFloat(maxScore)) return false;
        return true;
      });
    }

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        ...report,
        lowQualityRateCards,
      },
    });
  });
