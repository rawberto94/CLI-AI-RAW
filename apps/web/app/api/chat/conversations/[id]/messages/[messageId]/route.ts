/**
 * Message Feedback API - Update feedback on individual messages
 * 
 * PATCH /api/chat/conversations/[id]/messages/[messageId] - Update message feedback
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// PATCH /api/chat/conversations/[id]/messages/[messageId] - Update message
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  const { id: conversationId, messageId } = await (ctx as any).params as { id: string; messageId: string };
  const body = await request.json();

  // Verify conversation ownership
  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, tenantId, userId: ctx.userId } });

  if (!conversation) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
  }

  // Verify message belongs to conversation
  const existingMessage = await prisma.chatMessage.findFirst({
    where: { id: messageId, conversationId } });

  if (!existingMessage) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Message not found', 404);
  }

  const { feedback, feedbackComment, metadata } = body;

  const updateData: Record<string, unknown> = {};
  
  if (feedback !== undefined) {
    if (feedback !== null && !['positive', 'negative'].includes(feedback)) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid feedback. Must be positive, negative, or null', 400);
    }
    updateData.feedback = feedback;
  }
  
  if (feedbackComment !== undefined) {
    updateData.feedbackComment = feedbackComment;
  }
  
  if (metadata !== undefined) {
    updateData.metadata = metadata;
  }

  const message = await prisma.chatMessage.update({
    where: { id: messageId },
    data: updateData });

  return createSuccessResponse(ctx, {
    data: { message } });
})

// DELETE /api/chat/conversations/[id]/messages/[messageId] - Delete message
export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  const { id: conversationId, messageId } = await (ctx as any).params as { id: string; messageId: string };

  // Verify conversation ownership
  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, tenantId, userId: ctx.userId } });

  if (!conversation) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
  }

  // Verify message belongs to conversation
  const existingMessage = await prisma.chatMessage.findFirst({
    where: { id: messageId, conversationId } });

  if (!existingMessage) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Message not found', 404);
  }

  await prisma.chatMessage.delete({
    where: { id: messageId } });

  return createSuccessResponse(ctx, {
    message: 'Message deleted' });
})
