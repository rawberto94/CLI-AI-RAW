import { NextRequest } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

/**
 * POST /api/contracts/:id/comments/:commentId/resolve
 * Mark a comment as resolved
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const ctx = getApiContext(request);
  try {
    const { id: contractId, commentId } = params;
    const tenantId = await getApiTenantId(request);

    try {
      const db = await getDb();

      // Update comment resolution status
      const updatedComment = await db.contractComment.update({
        where: {
          id: commentId,
          tenantId,
          contractId
        },
        data: {
          isResolved: true,
          resolvedAt: new Date()
        }
      });

      return createSuccessResponse(ctx, {
        success: true,
        message: 'Comment resolved successfully',
        source: 'database',
        comment: {
          id: updatedComment.id,
          isResolved: updatedComment.isResolved,
          resolvedAt: updatedComment.resolvedAt?.toISOString()
        }
      });

    } catch (error) {
      return handleApiError(ctx, error);
    }

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
