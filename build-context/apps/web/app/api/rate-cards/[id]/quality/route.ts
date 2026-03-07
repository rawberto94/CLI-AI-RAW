import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { dataQualityScorerService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
try {
    const { id } = params;

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
}
