import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/versions
 * Get version history for an artifact
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const versions = await editableArtifactService.getArtifactVersionHistory(
      params.artifactId
    );

    return createSuccessResponse(ctx, {
      versions,
      total: versions.length,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
