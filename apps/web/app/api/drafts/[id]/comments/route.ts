import { logger } from '@/lib/logger';
/**
 * Draft Comments API
 * 
 * GET  /api/drafts/[id]/comments  — List all comments for a draft
 * POST /api/drafts/[id]/comments  — Create a comment (top-level or reply)
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

// GET — list comments (optionally filter by resolved status)
export async function GET(
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
    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get('resolved');

    // Verify draft exists
    const draft = await prisma.contractDraft.findFirst({
      where: { id: draftId, tenantId },
      select: { id: true },
    });
    if (!draft) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    const where: Record<string, unknown> = { draftId, tenantId, parentId: null };
    if (resolved === 'true') where.resolved = true;
    if (resolved === 'false') where.resolved = false;

    const comments = await prisma.draftComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
            },
          },
        },
      },
    });

    return createSuccessResponse(ctx, { comments });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// POST — create a comment
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
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]/comments', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { id: draftId } = await params;
    const body = await request.json();

    const { content, parentId, anchorPos } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Content is required', 400);
    }

    // Verify draft exists
    const draft = await prisma.contractDraft.findFirst({
      where: { id: draftId, tenantId },
      select: { id: true },
    });
    if (!draft) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    // If replying, verify parent exists
    if (parentId) {
      const parent = await prisma.draftComment.findFirst({
        where: { id: parentId, draftId },
      });
      if (!parent) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Parent comment not found', 404);
      }
    }

    const comment = await prisma.draftComment.create({
      data: {
        draftId,
        tenantId,
        userId: ctx.userId,
        content: content.trim(),
        parentId: parentId || null,
        anchorPos: anchorPos || {},
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        replies: {
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
      resourceId: comment.id,
      userId: ctx.userId,
      tenantId,
      metadata: { operation: 'create', draftId },
    }).catch(err => logger.error('[Draft] Audit log failed', err));

    return createSuccessResponse(ctx, { comment });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
