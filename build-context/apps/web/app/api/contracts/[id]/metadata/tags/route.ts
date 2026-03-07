import { NextRequest } from 'next/server';
import { metadataEditorService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/metadata/tags
 * Add tags to a contract
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const body = await request.json();
    const { tags, tenantId, userId } = body;

    if (!userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required', 400);
    }

    if (!tags || !Array.isArray(tags)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'tags array is required', 400);
    }

    await metadataEditorService.addTags(
      params.id,
      tenantId,
      tags,
      userId
    );

    return createSuccessResponse(ctx, {
      message: 'Tags added successfully',
      tags,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
