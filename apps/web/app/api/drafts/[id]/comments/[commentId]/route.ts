/**
 * Single Draft Comment API
 * 
 * PATCH  /api/drafts/[id]/comments/[commentId] — Update (edit text or resolve)
 * DELETE /api/drafts/[id]/comments/[commentId] — Delete a comment
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
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

export const dynamic = 'force-dynamic';

// PATCH — update comment content or resolved state
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  try {
    const tenantId = await getApiTenantId(request);
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]/comments/[commentId]', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { id: draftId, commentId } = await params;
    const body = await request.json();

    const existing = await prisma.draftComment.findFirst({
      where: { id: commentId, draftId, tenantId },
    });
    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comment not found', 404);
    }

    const update: Record<string, unknown> = {};
    if (typeof body.content === 'string') update.content = body.content.trim();
    if (typeof body.resolved === 'boolean') update.resolved = body.resolved;

    const comment = await prisma.draftComment.update({
      where: { id: commentId },
      data: update,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        replies: {
          orderBy: { createdAt: 'asc' as const },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
            },
          },
        },
      },
    });

    await auditLog({
      action: AuditAction.CONTRACT_UPDATED,
      resourceType: 'draft_comment',
      resourceId: commentId,
      userId: ctx.userId,
      tenantId,
      metadata: { operation: 'update', draftId },
    }).catch(err => console.error('[Draft] Audit log failed:', err));

    return createSuccessResponse(ctx, { comment });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// DELETE — remove a comment and its replies
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  try {
    const tenantId = await getApiTenantId(request);
    const rl2 = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]/comments/[commentId]', AI_RATE_LIMITS.standard);
    if (!rl2.allowed) return rateLimitResponse(rl2);

    const { id: draftId, commentId } = await params;

    const existing = await prisma.draftComment.findFirst({
      where: { id: commentId, draftId, tenantId },
    });
    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comment not found', 404);
    }

    // Cascade delete replies first
    await prisma.draftComment.deleteMany({ where: { parentId: commentId } });
    await prisma.draftComment.delete({ where: { id: commentId } });

    await auditLog({
      action: AuditAction.CONTRACT_DELETED,
      resourceType: 'draft_comment',
      resourceId: commentId,
      userId: ctx.userId,
      tenantId,
      metadata: { operation: 'delete', draftId },
    }).catch(err => console.error('[Draft] Audit log failed:', err));

    return createSuccessResponse(ctx, { message: 'Comment deleted' });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
