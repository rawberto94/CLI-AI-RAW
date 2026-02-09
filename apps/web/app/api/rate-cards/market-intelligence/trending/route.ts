import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const marketIntelService = new marketIntelligenceService(prisma);

    const trendingRoles = await marketIntelService.getTrendingRoles(
      ctx.tenantId,
      periodMonths
    );

    return createSuccessResponse(ctx, trendingRoles);
  });
