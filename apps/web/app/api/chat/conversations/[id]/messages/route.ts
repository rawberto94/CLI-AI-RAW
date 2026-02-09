/**
 * Chat Messages API - Message operations within a conversation
 * 
 * GET /api/chat/conversations/[id]/messages - List messages in conversation
 * POST /api/chat/conversations/[id]/messages - Add message to conversation
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { aiCopilotService } from 'data-orchestration/services';

export const dynamic = 'force-dynamic';

// GET /api/chat/conversations/[id]/messages - List messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  const tenantId = ctx.tenantId;

  try {
    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
    const before = searchParams.get('before'); // Get messages before this timestamp
    const after = searchParams.get('after'); // Get messages after this timestamp

    // Verify conversation ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, tenantId, userId: ctx.userId } });

    if (!conversation) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
    }

    const whereClause: Record<string, unknown> = { conversationId };
    
    if (before) {
      whereClause.createdAt = { ...(whereClause.createdAt as object || {}), lt: new Date(before) };
    }
    if (after) {
      whereClause.createdAt = { ...(whereClause.createdAt as object || {}), gt: new Date(after) };
    }

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: whereClause,
        orderBy: { createdAt: order },
        take: limit,
        skip: offset }),
      prisma.chatMessage.count({ where: { conversationId } }),
    ]);

    return createSuccessResponse(ctx, {
      data: {
        messages,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + messages.length < total } } });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// POST /api/chat/conversations/[id]/messages - Add message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  const tenantId = ctx.tenantId;

  try {
    const { id: conversationId } = await params;
    const body = await request.json();

    // Verify conversation ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, tenantId, userId: ctx.userId } });

    if (!conversation) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
    }

    const {
      role,
      content,
      toolCalls,
      toolResults,
      model,
      tokensUsed,
      responseTimeMs,
      metadata: _metadata } = body;

    if (!role || !content) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'role and content are required', 400);
    }

    if (!['user', 'assistant', 'system', 'tool'].includes(role)) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid role. Must be user, assistant, system, or tool', 400);
    }

    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        role,
        content,
        model: model || null,
        tokensUsed: tokensUsed || null,
        processingTime: responseTimeMs || null,
        // Store tool calls and results in sources JSON field
        sources: toolCalls || toolResults ? JSON.stringify({ toolCalls, toolResults }) : undefined } });

    // Update conversation's lastMessageAt
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() } });

    return createSuccessResponse(ctx, {
      data: { message } });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
