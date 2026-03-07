import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/artifacts/bulk-update
 * Bulk update multiple artifacts
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    await params; // Consume params even though we don't use id in this route
    const body = await request.json();
    const { updates, userId } = body;

    if (!userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    if (!updates || !Array.isArray(updates)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'updates array is required', 400);
    }

    const result = await editableArtifactService.bulkUpdateArtifacts(
      updates,
      userId
    );

    return createSuccessResponse(ctx, {
      message: 'Bulk update completed',
      successful: result.successful,
      failed: result.failed,
      totalProcessed: result.totalProcessed,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
