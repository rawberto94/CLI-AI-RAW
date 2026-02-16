import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { negotiationAssistantService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const negotiationService = new negotiationAssistantService(prisma);

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const rateCardId = params.id;

    // Generate comprehensive negotiation brief
    const brief = await negotiationService.generateNegotiationBrief(rateCardId);

    return createSuccessResponse(ctx, {
      success: true,
      data: brief,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate negotiation brief', 500)
  }
}
