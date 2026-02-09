import { NextRequest } from 'next/server';
import { metadataEditorService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

/**
 * POST /api/contracts/metadata/bulk-update
 * Bulk update metadata for multiple contracts
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const body = await request.json();
  const { contractIds, updates, userId } = body;

  if (!userId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'userId is required', 400);
  }

  if (!contractIds || !Array.isArray(contractIds)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractIds array is required', 400);
  }

  if (!updates) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'updates object is required', 400);
  }

  const result = await metadataEditorService.bulkUpdateMetadata({
    contractIds,
    updates,
    userId,
  });

  return createSuccessResponse(ctx, {
    message: 'Bulk metadata update completed',
    successful: result.successful,
    failed: result.failed,
    totalProcessed: contractIds.length,
  });
});
