/**
 * Chat Conversation Detail API - Single conversation operations
 * 
 * GET /api/chat/conversations/[id] - Get conversation with messages
 * PATCH /api/chat/conversations/[id] - Update conversation
 * DELETE /api/chat/conversations/[id] - Delete conversation
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// GET /api/chat/conversations/[id] - Get conversation with messages
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  const { id } = await (ctx as any).params as { id: string };
  const { searchParams } = new URL(request.url);
  
  const messageLimit = parseInt(searchParams.get('messageLimit') || '50');
  const messageOffset = parseInt(searchParams.get('messageOffset') || '0');

  const conversation = await prisma.chatConversation.findFirst({
    where: { id, tenantId, userId: ctx.userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: messageLimit,
        skip: messageOffset } } });

  if (!conversation) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
  }

  return createSuccessResponse(ctx, {
    data: { conversation } });
})

// PATCH /api/chat/conversations/[id] - Update conversation
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  const { id } = await (ctx as any).params as { id: string };
  const body = await request.json();

  // Verify ownership
  const existing = await prisma.chatConversation.findFirst({
    where: { id, tenantId, userId: ctx.userId } });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
  }

  const { title, isPinned, isArchived } = body;

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (isPinned !== undefined) updateData.isPinned = isPinned;
  if (isArchived !== undefined) updateData.isArchived = isArchived;

  const conversation = await prisma.chatConversation.update({
    where: { id },
    data: updateData });

  return createSuccessResponse(ctx, {
    data: { conversation } });
})

// DELETE /api/chat/conversations/[id] - Delete conversation
export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  const { id } = await (ctx as any).params as { id: string };

  // Verify ownership
  const existing = await prisma.chatConversation.findFirst({
    where: { id, tenantId, userId: ctx.userId } });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Conversation not found', 404);
  }

  // Delete conversation (cascades to messages)
  await prisma.chatConversation.delete({
    where: { id } });

  return createSuccessResponse(ctx, {
    message: 'Conversation deleted' });
})
