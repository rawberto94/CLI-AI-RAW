import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * PATCH /api/contracts/[id]/artifacts/[artifactId]/fields
 * Update a single field in an artifact
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const body = await request.json();
    const { fieldPath, value, userId } = body;

    if (!userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    if (!fieldPath) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'fieldPath is required', 400);
    }

    // Update the field
    await editableArtifactService.updateArtifactField(
      params.artifactId,
      fieldPath,
      value,
      userId
    );

    return createSuccessResponse(ctx, {
      message: 'Field updated successfully',
      fieldPath,
      value,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
