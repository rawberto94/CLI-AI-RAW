/**
 * AI Chat Conversation Detail API
 *
 * GET    /api/ai/chat/conversations/[id]  — Get conversation with messages
 * PATCH  /api/ai/chat/conversations/[id]  — Update title, pin, archive
 * DELETE /api/ai/chat/conversations/[id]  — Delete conversation + messages
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';

// ─── GET: Conversation with messages ────────────────────────────────────

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;
  const { id } = await (ctx as any).params;
  const url = new URL(request.url);

  const messagesLimit = Math.min(
    Math.max(parseInt(url.searchParams.get('messagesLimit') || '50', 10) || 50, 1),
    200,
  );
  const messagesCursor = url.searchParams.get('messagesCursor') || undefined;

  const conversation = await prisma.chatConversation.findFirst({
    where: { id, tenantId, userId },
    select: {
      id: true,
      title: true,
      context: true,
      contextType: true,
      messageCount: true,
      lastMessageAt: true,
      isArchived: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!conversation) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
  }

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: id },
    select: {
      id: true,
      role: true,
      content: true,
      model: true,
      tokensUsed: true,
      confidence: true,
      sources: true,
      suggestions: true,
      feedback: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: messagesLimit + 1,
    ...(messagesCursor ? { cursor: { id: messagesCursor }, skip: 1 } : {}),
  });

  const hasMoreMessages = messages.length > messagesLimit;
  const messageItems = hasMoreMessages ? messages.slice(0, messagesLimit) : messages;

  return createSuccessResponse(ctx, {
    conversation,
    messages: messageItems,
    pagination: {
      hasMore: hasMoreMessages,
      nextCursor: hasMoreMessages ? messageItems[messageItems.length - 1]?.id : undefined,
    },
  });
});

// ─── PATCH: Update conversation ─────────────────────────────────────────

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;
  const { id } = await (ctx as any).params;
  const body = await request.json();

  // Verify ownership
  const exists = await prisma.chatConversation.findFirst({
    where: { id, tenantId, userId },
    select: { id: true },
  });
  if (!exists) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === 'string') {
    data.title = body.title.slice(0, 200);
  }
  if (typeof body.isPinned === 'boolean') {
    data.isPinned = body.isPinned;
  }
  if (typeof body.isArchived === 'boolean') {
    data.isArchived = body.isArchived;
  }

  if (Object.keys(data).length === 0) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No valid fields to update', 400);
  }

  const updated = await prisma.chatConversation.update({
    where: { id },
    data,
    select: {
      id: true,
      title: true,
      isPinned: true,
      isArchived: true,
      updatedAt: true,
    },
  });

  return createSuccessResponse(ctx, { conversation: updated });
});

// ─── DELETE: Delete conversation and all messages ───────────────────────

export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;
  const { id } = await (ctx as any).params;

  // Verify ownership before delete
  const exists = await prisma.chatConversation.findFirst({
    where: { id, tenantId, userId },
    select: { id: true },
  });
  if (!exists) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
  }

  // Atomic delete with tenant isolation (avoids TOCTOU between findFirst and delete)
  await prisma.chatConversation.deleteMany({ where: { id, tenantId, userId } });

  return createSuccessResponse(ctx, { deleted: true });
});
