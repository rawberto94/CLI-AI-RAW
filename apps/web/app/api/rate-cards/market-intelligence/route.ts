import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const seniority = searchParams.get('seniority');
    const country = searchParams.get('country');
    const lineOfService = searchParams.get('lineOfService');
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const marketIntelService = new marketIntelligenceService(prisma);

    // Get market intelligence
    const intelligence = await marketIntelService.calculateMarketIntelligence({
      roleStandardized: role || undefined,
      seniority: seniority || undefined,
      country: country || undefined,
      lineOfService: lineOfService || undefined,
      periodMonths,
      tenantId: ctx.tenantId,
    });

    return createSuccessResponse(ctx, intelligence);
  });
