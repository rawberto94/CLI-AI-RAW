import { NextRequest } from 'next/server';
import { CompetitiveIntelligenceService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

const competitiveIntelligenceService = new CompetitiveIntelligenceService(prisma);

/**
 * GET /api/rate-cards/competitive-intelligence
 * Get competitive intelligence metrics and dashboard data
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const metrics = await competitiveIntelligenceService.calculateCompetitivenessScore(tenantId);

    return createSuccessResponse(ctx, metrics);
  });
