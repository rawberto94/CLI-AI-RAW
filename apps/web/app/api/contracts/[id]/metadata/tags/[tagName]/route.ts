import { NextRequest } from 'next/server';
import { metadataEditorService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * DELETE /api/contracts/[id]/metadata/tags/[tagName]
 * Remove a tag from a contract
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; tagName: string }> }
) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = await getApiTenantId(request);
    const userId = searchParams.get('userId');

    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID required', 400);
    }

    if (!userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    await metadataEditorService.removeTag(
      params.id,
      tenantId,
      decodeURIComponent(params.tagName),
      userId
    );

    return createSuccessResponse(ctx, {
      message: 'Tag removed successfully',
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
