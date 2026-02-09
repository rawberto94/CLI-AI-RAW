import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get('country') || undefined;
    const lineOfService = searchParams.get('lineOfService') || undefined;
    const roleCategory = searchParams.get('roleCategory') || undefined;
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const marketIntelService = new marketIntelligenceService(prisma);

    const rankings = await marketIntelService.getSupplierRanking(
      ctx.tenantId,
      {
        country,
        lineOfService,
        roleCategory,
        periodMonths,
      }
    );

    return createSuccessResponse(ctx, rankings);
  });
