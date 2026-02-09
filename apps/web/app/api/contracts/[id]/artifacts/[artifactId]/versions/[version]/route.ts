import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/versions/[version]
 * Get a specific version
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string; version: string }> }
) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const versionNumber = parseInt(params.version);
    if (isNaN(versionNumber)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid version number', 400);
    }

    const versions = await editableArtifactService.getArtifactVersionHistory(
      params.artifactId
    );

    const version = versions.find(v => v.version === versionNumber);

    if (!version) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Version not found', 404);
    }

    return createSuccessResponse(ctx, version);
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
