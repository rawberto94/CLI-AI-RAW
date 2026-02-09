import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { marketIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const marketIntelService = new marketIntelligenceService(prisma);

    const trends = await marketIntelService.detectEmergingTrends(
      ctx.tenantId
    );

    return createSuccessResponse(ctx, trends);
  });
