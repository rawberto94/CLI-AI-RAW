import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/versions/diff?v1=1&v2=2
 * 
 * Compare two versions of an artifact and return a structured diff.
 * Uses the editable-artifact service's compareVersions method.
 * 
 * Query params:
 * - v1: version number (older)
 * - v2: version number (newer)
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
    const { searchParams } = new URL(request.url);
    const v1 = parseInt(searchParams.get('v1') || '', 10);
    const v2 = parseInt(searchParams.get('v2') || '', 10);

    if (isNaN(v1) || isNaN(v2)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Both v1 and v2 query parameters are required (version numbers)', 400);
    }

    if (v1 === v2) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'v1 and v2 must be different versions', 400);
    }

    const comparison = await editableArtifactService.compareVersions(
      params.artifactId,
      Math.min(v1, v2),
      Math.max(v1, v2)
    );

    // Enrich with field-level summary
    const differences = comparison.differences || {};
    const fieldNames = Object.keys(differences);
    const summary = {
      totalFieldsChanged: fieldNames.length,
      fields: fieldNames,
      olderVersion: Math.min(v1, v2),
      newerVersion: Math.max(v1, v2),
      editedBy: comparison.version2?.editedBy || null,
      editedAt: comparison.version2?.editedAt || null,
      changeType: comparison.version2?.changeType || null,
      reason: comparison.version2?.reason || null,
    };

    return createSuccessResponse(ctx, {
      artifactId: params.artifactId,
      contractId: params.id,
      summary,
      version1: comparison.version1,
      version2: comparison.version2,
      differences,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
