import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/rates
 * Add a new rate card entry
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const body = await request.json();
    const { rate, userId } = body;

    if (!userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    if (!rate) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'rate data is required', 400);
    }

    const rateId = await editableArtifactService.addRateCardEntry(
      params.artifactId,
      rate,
      userId
    );

    return createSuccessResponse(ctx, {
      message: 'Rate card entry added successfully',
      rateId,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
