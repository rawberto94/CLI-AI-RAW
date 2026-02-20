/**
 * Draft Rejection API
 * 
 * POST /api/drafts/[id]/reject — Reject a draft (moves back to DRAFT)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  try {
    const tenantId = await getApiTenantId(request);
    const { id: draftId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason : '';

    if (!reason) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Rejection reason is required', 400);
    }

    const draft = await prisma.contractDraft.findFirst({
      where: { id: draftId, tenantId },
    });
    if (!draft) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    if (!['IN_REVIEW', 'PENDING_APPROVAL'].includes(draft.status)) {
      return createErrorResponse(
        ctx,
        'BAD_REQUEST',
        `Cannot reject a draft with status "${draft.status}". Must be IN_REVIEW or PENDING_APPROVAL.`,
        400,
      );
    }

    const existingWorkflow = Array.isArray(draft.approvalWorkflow) ? draft.approvalWorkflow : [];
    const rejectionEntry = {
      userId: ctx.userId,
      action: 'REJECTED',
      reason,
      timestamp: new Date().toISOString(),
    };

    const updated = await prisma.contractDraft.update({
      where: { id: draftId },
      data: {
        status: 'REJECTED',
        approvalWorkflow: [...(existingWorkflow as Record<string, unknown>[]), rejectionEntry],
      },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      data: { draft: updated },
      message: 'Draft rejected',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
