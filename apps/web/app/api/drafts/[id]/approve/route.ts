import { logger } from '@/lib/logger';
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
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]/approve', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

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
        approvalWorkflow: JSON.parse(JSON.stringify([...existingWorkflow, approvalEntry])),
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
        type: 'agent_complete',
        severity: 'info',
        title: 'Draft Approved',
        message: `Your draft "${updated.title}" has been approved.${comment ? ` Comment: ${comment}` : ''}`,
        source: 'approval-workflow',
        metadata: { draftId, action: 'APPROVED', approvedBy: ctx.userId },
        actionUrl: `/drafting/copilot?draft=${draftId}`,
      });
    }

    // Send email notification directly (no self-HTTP call)
    if (creator?.email) {
      const { sendEmail } = await import('@/lib/email/email-service');
      const recipientName = `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email;
      const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'}/drafting/copilot?draft=${draftId}`;
      sendEmail({
        to: creator.email,
        subject: `✓ Approved: "${updated.title}"`,
        html: `<p>Hi ${recipientName},</p><p>Your draft <strong>"${updated.title}"</strong> has been approved.</p>${comment ? `<p>Comment: ${comment}</p>` : ''}<p><a href="${actionUrl}">View Details</a></p>`,
      }).catch(() => { /* fire-and-forget */ });
    }

    await auditLog({
      action: AuditAction.APPROVAL_APPROVED,
      resourceType: 'draft',
      resourceId: draftId,
      userId: ctx.userId,
      tenantId,
      metadata: { operation: 'approve', title: updated.title },
    }).catch(err => logger.error('[Draft] Audit log failed', err));

    return createSuccessResponse(ctx, {
      draft: updated,
      message: 'Draft approved successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
