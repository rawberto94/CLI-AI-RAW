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

    const targetRates = await negotiationService.suggestTargetRates(rateCardId);

    return createSuccessResponse(ctx, {
      success: true,
      data: targetRates,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to suggest target rates', 500)
  }
}
