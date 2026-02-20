/**
 * Draft Approval API
 * 
 * POST /api/drafts/[id]/approve — Approve a draft (moves to APPROVED)
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
    const comment = typeof body.comment === 'string' ? body.comment : '';

    const draft = await prisma.contractDraft.findFirst({
      where: { id: draftId, tenantId },
    });
    if (!draft) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    // Only drafts in IN_REVIEW or PENDING_APPROVAL can be approved
    if (!['IN_REVIEW', 'PENDING_APPROVAL'].includes(draft.status)) {
      return createErrorResponse(
        ctx,
        'BAD_REQUEST',
        `Cannot approve a draft with status "${draft.status}". Must be IN_REVIEW or PENDING_APPROVAL.`,
        400,
      );
    }

    // Build approval entry
    const existingWorkflow = Array.isArray(draft.approvalWorkflow) ? draft.approvalWorkflow : [];
    const approvalEntry = {
      userId: ctx.userId,
      action: 'APPROVED',
      comment,
      timestamp: new Date().toISOString(),
    };

    const updated = await prisma.contractDraft.update({
      where: { id: draftId },
      data: {
        status: 'APPROVED',
        approvalWorkflow: [...(existingWorkflow as Record<string, unknown>[]), approvalEntry],
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
      message: 'Draft approved successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
