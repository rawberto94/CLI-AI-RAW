import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/revert/[version]
 * Revert artifact to a specific version
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string; version: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    const versionNumber = parseInt(params.version);
    if (isNaN(versionNumber)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid version number', 400);
    }

    await editableArtifactService.revertToVersion(
      params.artifactId,
      versionNumber,
      userId
    );

    return createSuccessResponse(ctx, {
      message: `Artifact reverted to version ${versionNumber}`,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
