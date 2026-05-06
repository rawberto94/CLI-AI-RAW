import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { dataQualityScorerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
try {
    const { id } = await (ctx as any).params as { id: string };
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const rateCard = await prisma.rateCardEntry.findFirst({
      where: {
        id,
        tenantId,
      },
      select: { id: true },
    });

    if (!rateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found', 404);
    }

    const qualityService = new dataQualityScorerService(prisma);
    const qualityScore = await qualityService.calculateQualityScore(id);

    return createSuccessResponse(ctx, {
      success: true,
      data: qualityScore,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to calculate quality score: ${message}`, 500);
  }
})
