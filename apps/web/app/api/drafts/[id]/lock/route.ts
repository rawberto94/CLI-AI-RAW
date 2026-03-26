/**
 * Draft Lock/Unlock API
 * 
 * POST /api/drafts/[id]/lock — Acquire or release a lock
 * 
 * Body: { action: 'lock' | 'unlock' }
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

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — auto-expire stale locks

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
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]/lock', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { id: draftId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    if (!['lock', 'unlock'].includes(action)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Action must be "lock" or "unlock"', 400);
    }

    const draft = await prisma.contractDraft.findFirst({
      where: { id: draftId, tenantId },
    });
    if (!draft) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    if (action === 'lock') {
      // Check if already locked by another user (and lock hasn't expired)
      if (draft.isLocked && draft.lockedBy && draft.lockedBy !== ctx.userId) {
        const lockAge = draft.lockedAt ? Date.now() - new Date(draft.lockedAt).getTime() : Infinity;
        if (lockAge < LOCK_TIMEOUT_MS) {
          return createErrorResponse(
            ctx,
            'INTERNAL_ERROR',
            `Draft is locked by another user (lock expires in ${Math.ceil((LOCK_TIMEOUT_MS - lockAge) / 1000)}s)`,
            423,
          );
        }
        // else lock has expired, allow override
      }

      const updated = await prisma.contractDraft.update({
        where: { id: draftId },
        data: {
          isLocked: true,
          lockedBy: ctx.userId,
          lockedAt: new Date(),
        },
        select: {
          id: true,
          isLocked: true,
          lockedBy: true,
          lockedAt: true,
        },
      });

      await auditLog({
        action: AuditAction.CONTRACT_UPDATED,
        resourceType: 'draft',
        resourceId: draftId,
        userId: ctx.userId,
        tenantId,
        metadata: { operation: 'lock' },
      }).catch(err => console.error('[Draft] Audit log failed:', err));

      return createSuccessResponse(ctx, { draft: updated });
    }

    // action === 'unlock'
    if (draft.isLocked && draft.lockedBy !== ctx.userId) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Cannot unlock a draft locked by another user', 403);
    }

    const updated = await prisma.contractDraft.update({
      where: { id: draftId },
      data: {
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
      },
      select: {
        id: true,
        isLocked: true,
        lockedBy: true,
        lockedAt: true,
      },
    });

    await auditLog({
      action: AuditAction.CONTRACT_UPDATED,
      resourceType: 'draft',
      resourceId: draftId,
      userId: ctx.userId,
      tenantId,
      metadata: { operation: 'unlock' },
    }).catch(err => console.error('[Draft] Audit log failed:', err));

    return createSuccessResponse(ctx, { draft: updated });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
