/**
 * AI Chat Conversations API — Server-side persistence
 *
 * GET  /api/ai/conversations          — List user's conversations
 * POST /api/ai/conversations          — Create or update a conversation
 * GET  /api/ai/conversations/[id]     — Load a single conversation with messages
 *
 * Wires ChatConversation + ChatMessage Prisma models into the chatbot.
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';

// ─── GET: List conversations ────────────────────────────────────────────

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId } = ctx;

  const conversations = await prisma.chatConversation.findMany({
    where: { tenantId, userId, isArchived: false },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      context: true,
      contextType: true,
      messageCount: true,
      lastMessageAt: true,
      isPinned: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ conversations });
});

// ─── POST: Save messages to a conversation ──────────────────────────────

interface SavePayload {
  conversationId?: string;
  title?: string;
  context?: string;
  contextType?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string;
    tokensUsed?: number;
    processingTime?: number;
    confidence?: number;
    sources?: unknown[];
    suggestions?: unknown[];
  }>;
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId } = ctx;
  const body = (await request.json()) as SavePayload;

  if (!body.messages || body.messages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 });
  }

  // Upsert conversation
  let conversationId = body.conversationId;

  if (!conversationId) {
    // Auto-generate title from first user message
    const firstUserMsg = body.messages.find(m => m.role === 'user');
    const autoTitle =
      body.title ||
      (firstUserMsg ? firstUserMsg.content.slice(0, 80).replace(/\n/g, ' ') : 'New conversation');

    const conversation = await prisma.chatConversation.create({
      data: {
        tenantId,
        userId,
        title: autoTitle,
        context: body.context || null,
        contextType: body.contextType || 'GENERAL',
        messageCount: body.messages.length,
        lastMessageAt: new Date(),
      },
    });
    conversationId = conversation.id;
  } else {
    // Verify ownership
    const existing = await prisma.chatConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
  }

  // Batch-create messages
  const created = await prisma.chatMessage.createMany({
    data: body.messages.map(msg => ({
      conversationId: conversationId!,
      role: msg.role,
      content: msg.content,
      model: msg.model || null,
      tokensUsed: msg.tokensUsed || null,
      processingTime: msg.processingTime || null,
      confidence: msg.confidence || null,
      sources: msg.sources ? JSON.stringify(msg.sources) : '[]',
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

  return NextResponse.json({
    conversationId,
    messagesCreated: created.count,
    totalMessages,
  });
});
