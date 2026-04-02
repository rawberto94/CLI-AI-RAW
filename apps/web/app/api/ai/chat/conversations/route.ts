/**
 * AI Chat Conversations API
 *
 * GET  /api/ai/chat/conversations         — List conversations for the current user
 * POST /api/ai/chat/conversations         — Create a new conversation
 *
 * Query params (GET):
 *   ?limit=20          — Max items (default 20, max 100)
 *   ?cursor=<id>       — Cursor-based pagination (last conversation id)
 *   ?contextType=CONTRACT|GENERAL|ANALYSIS — Filter by type
 *   ?contractId=<id>   — Filter by linked contract
 *   ?archived=true     — Include archived conversations
 *   ?q=<search>        — Search conversation titles
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';

// ─── GET: List conversations ────────────────────────────────────────────

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;
  const url = new URL(request.url);

  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100);
  const cursor = url.searchParams.get('cursor') || undefined;
  const contextType = url.searchParams.get('contextType') || undefined;
  const contractId = url.searchParams.get('contractId') || undefined;
  const includeArchived = url.searchParams.get('archived') === 'true';
  const search = url.searchParams.get('q') || undefined;

  const where: Record<string, unknown> = {
    tenantId,
    userId,
  };

  if (!includeArchived) {
    where.isArchived = false;
  }
  if (contextType) {
    where.contextType = contextType;
  }
  if (contractId) {
    where.context = contractId;
  }
  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }

  const conversations = await prisma.chatConversation.findMany({
    where,
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
    orderBy: [{ isPinned: 'desc' }, { lastMessageAt: 'desc' }],
    take: limit + 1, // Fetch one extra to detect next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = conversations.length > limit;
  const items = hasMore ? conversations.slice(0, limit) : conversations;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return createSuccessResponse(ctx, {
    conversations: items,
    pagination: {
      hasMore,
      nextCursor,
      limit,
    },
  });
});

// ─── POST: Create a new conversation ────────────────────────────────────

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;
  const body = await request.json();

  const title = typeof body.title === 'string' ? body.title.slice(0, 200) : 'New conversation';
  const contextType = ['CONTRACT', 'GENERAL', 'ANALYSIS'].includes(body.contextType)
    ? body.contextType
    : 'GENERAL';
  const contractId = typeof body.contractId === 'string' ? body.contractId : null;

  // If a contractId is provided, verify the user has access to it
  if (contractId) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true },
    });
    if (!contract) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Contract not found or access denied', 403);
    }
  }

  const conversation = await prisma.chatConversation.create({
    data: {
      tenantId,
      userId,
      title,
      context: contractId,
      contextType,
      messageCount: 0,
      lastMessageAt: new Date(),
    },
    select: {
      id: true,
      title: true,
      context: true,
      contextType: true,
      messageCount: true,
      lastMessageAt: true,
      createdAt: true,
    },
  });

  return createSuccessResponse(ctx, { conversation }, { status: 201 });
});
