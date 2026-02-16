import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { negotiationAssistantService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const negotiationService = new negotiationAssistantService(prisma);

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
try {
    const rateCardId = params.id;

    const alternatives = await negotiationService.findAlternatives(rateCardId);

    return createSuccessResponse(ctx, {
      success: true,
      data: alternatives,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to find alternative suppliers', 500)
  }
}
