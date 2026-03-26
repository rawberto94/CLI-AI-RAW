/**
 * Contract Comments API
 * CRUD operations for contract comments - Database persisted
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/tenant-server';
// TODO: Migrate contractComment/contractActivity operations to dedicated comment service
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { auditLog, AuditAction } from '@/lib/security/audit';

// Response type that maps to ContractComment model
interface CommentResponse {
  id: string;
  contractId: string;
  content: string;
  authorId: string;
  authorName?: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt?: string;
  isPinned: boolean;
  isResolved: boolean;
  parentId?: string | null;
  reactions: { emoji: string; userId: string; userName?: string }[];
  mentions: string[];
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  replies?: CommentResponse[];
}

// Transform database comment to API response
function transformComment(dbComment: any): CommentResponse {
  return {
    id: dbComment.id,
    contractId: dbComment.contractId,
    content: dbComment.content,
    authorId: dbComment.userId,
    authorName: dbComment.userName || undefined,
    authorEmail: dbComment.userEmail || undefined,
    createdAt: dbComment.createdAt.toISOString(),
    updatedAt: dbComment.updatedAt?.toISOString(),
    isPinned: dbComment.isPinned || false,
    isResolved: dbComment.isResolved,
    parentId: dbComment.parentId,
    reactions: Array.isArray(dbComment.reactions) ? dbComment.reactions : [],
    mentions: dbComment.mentions || [],
    resolvedBy: dbComment.resolvedBy,
    resolvedAt: dbComment.resolvedAt?.toISOString(),
    replies: dbComment.replies?.map(transformComment) || [],
  };
}

export const GET = withAuthApiHandler(async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const filter = searchParams.get('filter') || 'all';
  const tenantId = await getApiTenantId(request);
  
  if (!contractId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId is required', 400);
  }

  // Build where clause
  const where: any = {
    contractId,
    parentId: null, // Only fetch top-level comments, replies come via include
  };

  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (filter === 'unresolved') {
    where.isResolved = false;
  }
  // Note: isPinned is not a database field - filtering handled at UI level

  // Fetch from database with replies
  const dbComments = await prisma.contractComment.findMany({
    where,
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
  });

  const comments = dbComments.map(transformComment);

  // Count unresolved
  const unresolvedCount = await prisma.contractComment.count({
    where: {
      contractId,
      ...(tenantId ? { tenantId } : {}),
      isResolved: false,
    },
  });

  return createSuccessResponse(ctx, {
    comments,
    total: comments.length,
    unresolved: unresolvedCount,
  });
});

export const POST = withAuthApiHandler(async (request, ctx) => {
  const body = await request.json();
  const { 
    contractId, 
    content, 
    authorId, 
    authorName, 
    authorEmail: _authorEmail,
    parentId,
    mentions,
  } = body;

  const tenantId = await getApiTenantId(request) || body.tenantId;

  if (!contractId || !content || !authorId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId, content, and authorId are required', 400);
  }

  // Verify parent exists if provided
  if (parentId) {
    const parent = await prisma.contractComment.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Parent comment not found', 404);
    }
  }

  // Create comment in database
  const dbComment = await prisma.contractComment.create({
    data: {
      contractId,
      tenantId,
      userId: authorId,
      content,
      parentId,
      mentions: mentions || [],
      reactions: [],
      isResolved: false,
    },
    include: {
      replies: true,
    },
  });

  // Also create activity log for comment
  await prisma.contractActivity.create({
    data: {
      contractId,
      tenantId,
      userId: authorId,
      type: 'comment',
      action: `${authorName || 'User'} added a comment`,
      details: content.substring(0, 200),
      metadata: {
        commentId: dbComment.id,
        isReply: !!parentId,
      },
    },
  }).catch(err => logger.error('Failed to create activity:', err));

  const comment = transformComment(dbComment);

  await auditLog({
    action: AuditAction.COLLABORATOR_COMMENTED,
    resourceType: 'contract',
    resourceId: contractId,
    userId: ctx.userId,
    tenantId,
    metadata: { commentId: dbComment.id },
  }).catch(err => logger.error('[Comments] Audit log failed:', err));

  return createSuccessResponse(ctx, { comment }, { status: 201 });
});

export const PUT = withAuthApiHandler(async (request, ctx) => {
  const body = await request.json();
  const { commentId, contractId: _contractId, content, isPinned, isResolved, resolvedBy } = body;
  const tenantId = await getApiTenantId(request);

  if (!commentId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'commentId is required', 400);
  }

  // Find the comment
  const existing = await prisma.contractComment.findUnique({
    where: { id: commentId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Comment not found', 404);
  }

  // Verify tenant access
  if (tenantId && existing.tenantId !== tenantId) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Comment not found', 404);
  }

  // Build update data
  const updateData: any = {};
  if (content !== undefined) {
    updateData.content = content;
  }
  if (isPinned !== undefined) {
    updateData.isPinned = isPinned;
  }
  if (isResolved !== undefined) {
    updateData.isResolved = isResolved;
    if (isResolved) {
      updateData.resolvedBy = resolvedBy || null;
      updateData.resolvedAt = new Date();
    } else {
      updateData.resolvedBy = null;
      updateData.resolvedAt = null;
    }
  }

  // Update in database
  const dbComment = await prisma.contractComment.update({
    where: { id: commentId },
    data: updateData,
    include: {
      replies: true,
    },
  });

  const comment = transformComment(dbComment);

  await auditLog({
    action: AuditAction.CONTRACT_UPDATED,
    resourceType: 'contract',
    resourceId: body.contractId || dbComment.contractId,
    userId: ctx.userId,
    tenantId: tenantId || '',
    metadata: { commentId: dbComment.id, action: 'comment_edited' },
  }).catch(err => logger.error('[Comments] Audit log failed:', err));

  return createSuccessResponse(ctx, { comment });
});

export const DELETE = withAuthApiHandler(async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get('commentId');
  const tenantId = await getApiTenantId(request);

  if (!commentId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'commentId is required', 400);
  }

  // Find the comment
  const existing = await prisma.contractComment.findUnique({
    where: { id: commentId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Comment not found', 404);
  }

  // Verify tenant access
  if (tenantId && existing.tenantId !== tenantId) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Comment not found', 404);
  }

  // Delete comment (cascade will handle replies due to schema)
  await prisma.contractComment.delete({
    where: { id: commentId },
  });

  await auditLog({
    action: AuditAction.CONTRACT_UPDATED,
    resourceType: 'contract',
    resourceId: existing.contractId,
    userId: ctx.userId,
    tenantId: tenantId || existing.tenantId,
    metadata: { commentId, action: 'comment_deleted' },
  }).catch(err => logger.error('[Comments] Audit log failed:', err));

  return createSuccessResponse(ctx, { deleted: true });
});
