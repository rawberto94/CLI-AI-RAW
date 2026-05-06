import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { negotiationAssistantEnhancedService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
try {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const { id } = await (ctx as any).params as { id: string };

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

    const talkingPoints = await negotiationAssistantEnhancedService.generateEnhancedTalkingPoints(
      id,
      tenantId
    );

    return createSuccessResponse(ctx, {
      success: true,
      data: talkingPoints,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate talking points', 500)
  }
})
