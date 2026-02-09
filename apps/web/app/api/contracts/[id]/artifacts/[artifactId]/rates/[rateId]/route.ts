import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * PUT /api/contracts/[id]/artifacts/[artifactId]/rates/[rateId]
 * Update a rate card entry
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string; rateId: string }> }
) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const body = await request.json();
    const { updates, userId } = body;

    if (!userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    if (!updates) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'updates are required', 400);
    }

    await editableArtifactService.updateRateCardEntry(
      params.artifactId,
      params.rateId,
      updates,
      userId
    );

    return createSuccessResponse(ctx, {
      message: 'Rate card entry updated successfully',
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * DELETE /api/contracts/[id]/artifacts/[artifactId]/rates/[rateId]
 * Delete a rate card entry
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string; rateId: string }> }
) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    await editableArtifactService.deleteRateCardEntry(
      params.artifactId,
      params.rateId,
      userId
    );

    return createSuccessResponse(ctx, {
      message: 'Rate card entry deleted successfully',
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
