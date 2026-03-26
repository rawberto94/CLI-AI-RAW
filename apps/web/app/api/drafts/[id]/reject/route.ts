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
import { pushAgentNotification } from '@/lib/ai/agent-notifications';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

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
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]/reject', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

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
        approvalWorkflow: JSON.parse(JSON.stringify([...existingWorkflow, rejectionEntry])),
      },
    });

    // Fetch creator for notifications (separate query to avoid TS include issues)
    const creator = updated.createdBy
      ? await prisma.user.findUnique({
          where: { id: updated.createdBy },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : null;

    // Push in-app notification to draft author
    if (creator) {
      pushAgentNotification({
        tenantId,
        userId: updated.createdBy || undefined,
        type: 'risk_alert',
        severity: 'high',
        title: 'Draft Rejected',
        message: `Your draft "${updated.title}" was rejected. Reason: ${reason}`,
        source: 'approval-workflow',
        metadata: { draftId, action: 'REJECTED', rejectedBy: ctx.userId, reason },
        actionUrl: `/drafting/copilot?draft=${draftId}`,
      });
    }

    // Send email notification via approvals notify API (fire-and-forget)
    if (creator?.email) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'}/api/approvals/notify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': ctx.userId,
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          type: 'approval_rejected',
          contractId: draftId,
          contractTitle: updated.title,
          recipientEmail: creator.email,
          recipientName: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email,
          senderName: ctx.userId,
          message: reason,
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'}/drafting/copilot?draft=${draftId}`,
        }),
      }).catch(() => { /* fire-and-forget */ });
    }

    await auditLog({
      action: AuditAction.APPROVAL_REJECTED,
      resourceType: 'draft',
      resourceId: draftId,
      userId: ctx.userId,
      tenantId,
      metadata: { operation: 'reject', title: updated.title, reason },
    }).catch(err => console.error('[Draft] Audit log failed:', err));

    return createSuccessResponse(ctx, {
      draft: updated,
      message: 'Draft rejected',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
