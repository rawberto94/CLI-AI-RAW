import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const seniority = searchParams.get('seniority');
    const lineOfService = searchParams.get('lineOfService') || undefined;

    if (!role || !seniority) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Role and seniority are required', 400);
    }

    const marketIntelService = new marketIntelligenceService(prisma);

    const comparison = await marketIntelService.getGeographicComparison(
      ctx.tenantId,
      role,
      seniority,
      lineOfService
    );

    return createSuccessResponse(ctx, comparison);
  });
