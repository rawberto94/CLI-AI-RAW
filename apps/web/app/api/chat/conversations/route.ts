/**
 * Chat Conversations API - Persist AI Copilot chat history
 * 
 * GET /api/chat/conversations - List user's conversations
 * POST /api/chat/conversations - Create a new conversation
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { aiCopilotService } from 'data-orchestration/services';

export const dynamic = 'force-dynamic';

// GET /api/chat/conversations - List conversations
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    
    const contextType = searchParams.get('contextType');
    const context = searchParams.get('context');
    const archived = searchParams.get('archived') === 'true';
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    const where: Record<string, unknown> = {
      tenantId,
      userId: ctx.userId,
      isArchived: archived };

    if (contextType) {
      where.contextType = contextType;
    }
    if (context) {
      where.context = context;
    }

    const conversations = await prisma.chatConversation.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { lastMessageAt: 'desc' },
      ],
      take: limit,
      skip: offset,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true } } } });

    const total = await prisma.chatConversation.count({ where });

    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      title: conv.title || 'New Conversation',
      context: conv.context,
      contextType: conv.contextType,
      messageCount: conv.messageCount,
      lastMessageAt: conv.lastMessageAt,
      lastMessage: conv.messages[0] || null,
      isPinned: conv.isPinned,
      isArchived: conv.isArchived,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt }));

    return createSuccessResponse(ctx, {
      data: {
        conversations: formattedConversations,
        total,
        limit,
        offset } });
  });

// POST /api/chat/conversations - Create conversation
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();

    const {
      title,
      context,
      contextType = 'GENERAL' } = body;

    const conversation = await prisma.chatConversation.create({
      data: {
        tenantId,
        userId: ctx.userId,
        title: title || 'New Conversation',
        context,
        contextType,
        messageCount: 0 } });

    return createSuccessResponse(ctx, {
      data: { conversation } });
  });
