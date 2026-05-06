import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { negotiationAssistantService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

const negotiationService = new negotiationAssistantService(prisma);

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id: rateCardId } = await (ctx as any).params as { id: string };

  try {
    const existingRateCard = await prisma.rateCardEntry.findFirst({
      where: {
        id: rateCardId,
        tenantId: ctx.tenantId,
      },
      select: { id: true },
    });

    if (!existingRateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found', 404);
    }

    // Generate comprehensive negotiation brief
    const brief = await negotiationService.generateNegotiationBrief(rateCardId);

    return createSuccessResponse(ctx, {
      success: true,
      data: brief,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate negotiation brief', 500)
  }
});
