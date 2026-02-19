/**
 * Batch Chat Messages API - Bulk message operations
 * 
 * POST /api/chat/conversations/[id]/messages/batch - Batch-save messages to conversation
 * 
 * Ported from legacy /api/ai/conversations POST endpoint.
 * Supports saving multiple messages in a single request via createMany.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  type AuthenticatedApiContext,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

interface BatchMessagePayload {
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    model?: string;
    tokensUsed?: number;
    processingTime?: number;
    confidence?: number;
    sources?: unknown[];
    suggestions?: unknown[];
    toolCalls?: unknown;
    toolResults?: unknown;
  }>;
}

export const POST = withAuthApiHandler(
  async (request: NextRequest, ctx: AuthenticatedApiContext) => {
    const resolvedParams = await (ctx as any).params;
    const conversationId = resolvedParams?.id;

    if (!conversationId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Conversation ID is required', 400);
    }

    // Verify conversation ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, tenantId: ctx.tenantId, userId: ctx.userId },
    });

    if (!conversation) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
    }

    const body = (await request.json()) as BatchMessagePayload;

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'messages array is required and must not be empty', 400);
    }

    if (body.messages.length > 200) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Maximum 200 messages per batch', 400);
    }

    const validRoles = ['user', 'assistant', 'system', 'tool'];
    for (const msg of body.messages) {
      if (!msg.role || !msg.content) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Each message requires role and content', 400);
      }
      if (!validRoles.includes(msg.role)) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid role "${msg.role}". Must be one of: ${validRoles.join(', ')}`, 400);
      }
    }

    // Batch-create all messages
    const created = await prisma.chatMessage.createMany({
      data: body.messages.map((msg) => ({
        conversationId,
        role: msg.role,
        content: msg.content,
        model: msg.model || null,
        tokensUsed: msg.tokensUsed || null,
        processingTime: msg.processingTime || null,
        confidence: msg.confidence ?? null,
        sources: msg.sources
          ? JSON.stringify(msg.sources)
          : msg.toolCalls || msg.toolResults
            ? JSON.stringify({ toolCalls: msg.toolCalls, toolResults: msg.toolResults })
            : '[]',
        suggestions: msg.suggestions ? JSON.stringify(msg.suggestions) : '[]',
      })),
    });

    // Update conversation stats
    const totalMessages = await prisma.chatMessage.count({
      where: { conversationId },
    });

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        messageCount: totalMessages,
        lastMessageAt: new Date(),
      },
    });

    return createSuccessResponse(ctx, {
      data: {
        conversationId,
        messagesCreated: created.count,
        totalMessages,
      },
    });
  }
);
