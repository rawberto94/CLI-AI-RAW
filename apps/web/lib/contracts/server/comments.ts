import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { auditLog, AuditAction } from '@/lib/security/audit';

import type { ContractApiContext } from '@/lib/contracts/server/context';

const createCommentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  parentId: z.string().nullable().optional(),
  mentions: z.array(z.string()).default([]),
});

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

interface NoteResponse {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  author: {
    id: string;
    name: string;
    avatar?: undefined;
  };
  isPinned: boolean;
  mentions: string[];
}

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

function transformNote(dbComment: any): NoteResponse {
  return {
    id: dbComment.id,
    content: dbComment.content,
    createdAt: dbComment.createdAt.toISOString(),
    updatedAt: dbComment.updatedAt?.toISOString(),
    author: {
      id: dbComment.userId,
      name: dbComment.userId,
      avatar: undefined,
    },
    isPinned: (dbComment.reactions as Array<{ type?: string }> || []).some((reaction) => reaction.type === 'pinned'),
    mentions: dbComment.mentions || [],
  };
}

async function getPrismaClient() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

async function findTenantContract(contractId: string, tenantId: string) {
  const prisma = await getPrismaClient();

  return prisma.contract.findFirst({
    where: {
      id: contractId,
      tenantId,
    },
    select: { id: true },
  });
}

export async function getContractComments(
  request: NextRequest,
  context: ContractApiContext,
) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const filter = searchParams.get('filter') || 'all';
  const tenantId = context.tenantId;

  if (!contractId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'contractId is required', 400);
  }

  const contract = await findTenantContract(contractId, tenantId);
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const where: Record<string, unknown> = {
    contractId,
    tenantId,
    parentId: null,
  };

  if (filter === 'unresolved') {
    where.isResolved = false;
  }

  const prisma = await getPrismaClient();
  const dbComments = await prisma.contractComment.findMany({
    where,
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  const comments = dbComments.map(transformComment);
  const unresolvedCount = await prisma.contractComment.count({
    where: {
      contractId,
      tenantId,
      isResolved: false,
    },
  });

  return createSuccessResponse(context, {
    comments,
    total: comments.length,
    unresolved: unresolvedCount,
  });
}

export async function postContractComment(
  request: NextRequest,
  context: ContractApiContext,
) {
  const body = await request.json();
  const { contractId, content, parentId, mentions } = body;
  const tenantId = context.tenantId;

  if (!contractId || !content) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'contractId and content are required', 400);
  }

  const contract = await findTenantContract(contractId, tenantId);
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  if (parentId) {
    const prisma = await getPrismaClient();
    const parent = await prisma.contractComment.findFirst({
      where: {
        id: parentId,
        contractId,
        tenantId,
      },
      select: { id: true },
    });
    if (!parent) {
      return createErrorResponse(context, 'NOT_FOUND', 'Parent comment not found', 404);
    }
  }

  const prisma = await getPrismaClient();
  const dbComment = await prisma.contractComment.create({
    data: {
      contractId,
      tenantId,
      userId: context.userId,
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

  await prisma.contractActivity.create({
    data: {
      contractId,
      tenantId,
      userId: context.userId,
      type: 'comment',
      action: 'User added a comment',
      details: content.substring(0, 200),
      metadata: {
        commentId: dbComment.id,
        isReply: Boolean(parentId),
      },
    },
  }).catch((error) => logger.error('Failed to create activity:', error));

  await auditLog({
    action: AuditAction.COLLABORATOR_COMMENTED,
    resourceType: 'contract',
    resourceId: contractId,
    userId: context.userId,
    tenantId,
    metadata: { commentId: dbComment.id },
  }).catch((error) => logger.error('[Comments] Audit log failed:', error));

  return createSuccessResponse(context, { comment: transformComment(dbComment) }, { status: 201 });
}

export async function putContractComment(
  request: NextRequest,
  context: ContractApiContext,
) {
  const body = await request.json();
  const { commentId, content, isPinned, isResolved } = body;
  const tenantId = context.tenantId;
  const isTenantAdmin = context.userRole === 'admin' || context.userRole === 'owner';

  if (!commentId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'commentId is required', 400);
  }

  const prisma = await getPrismaClient();
  const existing = await prisma.contractComment.findUnique({
    where: { id: commentId },
  });
  if (!existing) {
    return createErrorResponse(context, 'NOT_FOUND', 'Comment not found', 404);
  }
  if (existing.tenantId !== tenantId) {
    return createErrorResponse(context, 'NOT_FOUND', 'Comment not found', 404);
  }

  const isResolutionOnly = content === undefined && isPinned === undefined && isResolved !== undefined;
  if (!isResolutionOnly && !isTenantAdmin && existing.userId !== context.userId) {
    return createErrorResponse(context, 'FORBIDDEN', 'Forbidden - Only the author or an admin can edit this comment', 403);
  }

  const updateData: Record<string, unknown> = {};
  if (content !== undefined) {
    updateData.content = content;
  }
  if (isPinned !== undefined) {
    updateData.isPinned = isPinned;
  }
  if (isResolved !== undefined) {
    updateData.isResolved = isResolved;
    if (isResolved) {
      updateData.resolvedBy = context.userId;
      updateData.resolvedAt = new Date();
    } else {
      updateData.resolvedBy = null;
      updateData.resolvedAt = null;
    }
  }

  const dbComment = await prisma.contractComment.update({
    where: { id: commentId },
    data: updateData,
    include: {
      replies: true,
    },
  });

  await auditLog({
    action: AuditAction.CONTRACT_UPDATED,
    resourceType: 'contract',
    resourceId: body.contractId || dbComment.contractId,
    userId: context.userId,
    tenantId,
    metadata: { commentId: dbComment.id, action: 'comment_edited' },
  }).catch((error) => logger.error('[Comments] Audit log failed:', error));

  return createSuccessResponse(context, { comment: transformComment(dbComment) });
}

export async function deleteContractComment(
  request: NextRequest,
  context: ContractApiContext,
) {
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get('commentId');
  const tenantId = context.tenantId;
  const isTenantAdmin = context.userRole === 'admin' || context.userRole === 'owner';

  if (!commentId) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'commentId is required', 400);
  }

  const prisma = await getPrismaClient();
  const existing = await prisma.contractComment.findUnique({
    where: { id: commentId },
  });
  if (!existing) {
    return createErrorResponse(context, 'NOT_FOUND', 'Comment not found', 404);
  }
  if (existing.tenantId !== tenantId) {
    return createErrorResponse(context, 'NOT_FOUND', 'Comment not found', 404);
  }
  if (!isTenantAdmin && existing.userId !== context.userId) {
    return createErrorResponse(context, 'FORBIDDEN', 'Forbidden - Only the author or an admin can delete this comment', 403);
  }

  await prisma.contractComment.delete({
    where: { id: commentId },
  });

  await auditLog({
    action: AuditAction.CONTRACT_UPDATED,
    resourceType: 'contract',
    resourceId: existing.contractId,
    userId: context.userId,
    tenantId: tenantId || existing.tenantId,
    metadata: { commentId, action: 'comment_deleted' },
  }).catch((error) => logger.error('[Comments] Audit log failed:', error));

  return createSuccessResponse(context, { deleted: true });
}

export async function getContractCommentsForContract(
  context: ContractApiContext,
  contractId: string,
) {
  const { default: getDb } = await import('@/lib/prisma');
  const db = await getDb();

  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
    },
    select: { id: true },
  });
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const comments = await db.contractComment.findMany({
    where: {
      contractId,
      tenantId: context.tenantId,
      parentId: null,
    },
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const userIds = new Set<string>();
  comments.forEach((comment) => {
    userIds.add(comment.userId);
    comment.replies?.forEach((reply) => userIds.add(reply.userId));
  });

  const users = await db.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  const userMap = new Map(users.map((user) => [user.id, user]));
  const getUserInfo = (userId: string) => {
    const user = userMap.get(userId);
    if (user) {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];
      return { author: fullName, authorEmail: user.email };
    }
    return { author: userId, authorEmail: `${userId}@unknown.com` };
  };

  const formattedComments = comments.map((comment) => {
    const userInfo = getUserInfo(comment.userId);
    return {
      id: comment.id,
      author: userInfo.author,
      authorEmail: userInfo.authorEmail,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      mentions: comment.mentions,
      isResolved: comment.isResolved,
      likes: comment.likes,
      replies: comment.replies?.map((reply) => {
        const replyUserInfo = getUserInfo(reply.userId);
        return {
          id: reply.id,
          author: replyUserInfo.author,
          authorEmail: replyUserInfo.authorEmail,
          content: reply.content,
          createdAt: reply.createdAt.toISOString(),
          mentions: reply.mentions,
          isResolved: reply.isResolved,
          likes: reply.likes,
        };
      }) || [],
    };
  });

  return createSuccessResponse(context, {
    success: true,
    comments: formattedComments,
    source: 'database',
  });
}

export async function postContractCommentForContract(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const { default: getDb } = await import('@/lib/prisma');
  const db = await getDb();
  const { content, parentId, mentions } = createCommentSchema.parse(await request.json());

  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
    },
    select: { id: true },
  });
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  if (parentId) {
    const parentComment = await db.contractComment.findFirst({
      where: {
        id: parentId,
        contractId,
        tenantId: context.tenantId,
      },
      select: { id: true },
    });
    if (!parentComment) {
      return createErrorResponse(context, 'NOT_FOUND', 'Parent comment not found', 404);
    }
  }

  const newComment = await db.contractComment.create({
    data: {
      contractId,
      tenantId: context.tenantId,
      userId: context.userId,
      content,
      mentions: mentions || [],
      parentId: parentId || null,
    },
  });

  return createSuccessResponse(context, {
    success: true,
    comment: {
      id: newComment.id,
      author: context.userId,
      content: newComment.content,
      createdAt: newComment.createdAt.toISOString(),
      mentions: newComment.mentions,
      isResolved: newComment.isResolved,
      likes: newComment.likes,
      parentId: newComment.parentId,
    },
    message: 'Comment added successfully',
    source: 'database',
  });
}

export async function resolveContractCommentForContract(
  context: ContractApiContext,
  contractId: string,
  commentId: string,
) {
  const { default: getDb } = await import('@/lib/prisma');
  const db = await getDb();

  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
    },
    select: { id: true },
  });
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const existingComment = await db.contractComment.findFirst({
    where: {
      id: commentId,
      tenantId: context.tenantId,
      contractId,
    },
    select: { id: true },
  });
  if (!existingComment) {
    return createErrorResponse(context, 'NOT_FOUND', 'Comment not found', 404);
  }

  const updatedComment = await db.contractComment.update({
    where: {
      id: existingComment.id,
    },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: context.userId,
    },
  });

  return createSuccessResponse(context, {
    success: true,
    message: 'Comment resolved successfully',
    source: 'database',
    comment: {
      id: updatedComment.id,
      isResolved: updatedComment.isResolved,
      resolvedAt: updatedComment.resolvedAt?.toISOString(),
    },
  });
}

export async function getContractNotes(
  context: ContractApiContext,
  contractId: string,
) {
  const { default: getDb } = await import('@/lib/prisma');
  const db = await getDb();

  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
      isDeleted: false,
    },
    select: { id: true },
  });
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const notes = await db.contractComment.findMany({
    where: {
      contractId,
      tenantId: context.tenantId,
      parentId: null,
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  const formattedNotes = notes.map(transformNote).sort((first, second) => {
    if (first.isPinned && !second.isPinned) return -1;
    if (!first.isPinned && second.isPinned) return 1;
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });

  return createSuccessResponse(context, { notes: formattedNotes });
}

export async function postContractNote(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const { default: getDb } = await import('@/lib/prisma');
  const db = await getDb();
  const body = await request.json();
  const { content, mentions = [] } = body;

  if (!content?.trim()) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Note content is required', 400);
  }

  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
      isDeleted: false,
    },
    select: { id: true, contractTitle: true },
  });
  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const note = await db.contractComment.create({
    data: {
      contractId,
      tenantId: context.tenantId,
      userId: context.userId,
      content: content.trim(),
      mentions,
      reactions: [],
      parentId: null,
    },
  });

  await db.contractActivity.create({
    data: {
      contractId,
      tenantId: context.tenantId,
      userId: context.userId,
      type: 'comment',
      action: `Added a note to "${contract.contractTitle || 'contract'}"`,
      metadata: { noteId: note.id },
    },
  }).catch((error: unknown) => logger.error('Failed to create note activity:', error));

  return createSuccessResponse(context, {
    note: transformNote(note),
  }, { status: 201 });
}

export async function getContractNote(
  context: ContractApiContext,
  contractId: string,
  noteId: string,
) {
  const { default: getDb } = await import('@/lib/prisma');
  const db = await getDb();

  const note = await db.contractComment.findFirst({
    where: {
      id: noteId,
      contractId,
      tenantId: context.tenantId,
    },
  });
  if (!note) {
    return createErrorResponse(context, 'NOT_FOUND', 'Note not found', 404);
  }

  return createSuccessResponse(context, { note: transformNote(note) });
}

export async function patchContractNote(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
  noteId: string,
) {
  const { default: getDb } = await import('@/lib/prisma');
  const db = await getDb();
  const body = await request.json();
  const { content, isPinned } = body;
  const isTenantAdmin = context.userRole === 'admin' || context.userRole === 'owner';

  const existingNote = await db.contractComment.findFirst({
    where: {
      id: noteId,
      contractId,
      tenantId: context.tenantId,
    },
  });
  if (!existingNote) {
    return createErrorResponse(context, 'NOT_FOUND', 'Note not found', 404);
  }

  if (!isTenantAdmin && existingNote.userId !== context.userId) {
    return createErrorResponse(context, 'FORBIDDEN', 'Forbidden - Only the author or an admin can edit this note', 403);
  }

  const updateData: Record<string, unknown> = {};
  if (content !== undefined) {
    if (!content.trim()) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Note content cannot be empty', 400);
    }
    updateData.content = content.trim();
  }

  if (isPinned !== undefined) {
    const reactions = (existingNote.reactions as Array<{ type?: string; userId?: string }>) || [];
    if (isPinned) {
      const hasPinned = reactions.some((reaction) => reaction.type === 'pinned');
      updateData.reactions = hasPinned ? reactions : [...reactions, { type: 'pinned', userId: context.userId }];
    } else {
      updateData.reactions = reactions.filter((reaction) => reaction.type !== 'pinned');
    }
  }

  const updatedNote = await db.contractComment.update({
    where: { id: noteId },
    data: updateData as any,
  });

  await db.contractActivity.create({
    data: {
      contractId,
      tenantId: context.tenantId,
      userId: context.userId,
      type: 'comment',
      action: content !== undefined ? 'Updated a note' : isPinned ? 'Pinned a note' : 'Unpinned a note',
      metadata: { noteId },
    },
  }).catch((error: unknown) => logger.error('Failed to update note activity:', error));

  return createSuccessResponse(context, {
    success: true,
    note: transformNote(updatedNote),
  });
}

export async function deleteContractNote(
  context: ContractApiContext,
  contractId: string,
  noteId: string,
) {
  const { default: getDb } = await import('@/lib/prisma');
  const db = await getDb();
  const isTenantAdmin = context.userRole === 'admin' || context.userRole === 'owner';

  const existingNote = await db.contractComment.findFirst({
    where: {
      id: noteId,
      contractId,
      tenantId: context.tenantId,
    },
  });
  if (!existingNote) {
    return createErrorResponse(context, 'NOT_FOUND', 'Note not found', 404);
  }

  if (!isTenantAdmin && existingNote.userId !== context.userId) {
    return createErrorResponse(context, 'FORBIDDEN', 'Forbidden - Only the author or an admin can delete this note', 403);
  }

  await db.contractComment.delete({
    where: { id: noteId },
  });

  await db.contractActivity.create({
    data: {
      contractId,
      tenantId: context.tenantId,
      userId: context.userId,
      type: 'comment',
      action: 'Deleted a note',
      metadata: { noteId },
    },
  }).catch((error: unknown) => logger.error('Failed to delete note activity:', error));

  return createSuccessResponse(context, {
    success: true,
    message: 'Note deleted successfully',
  });
}