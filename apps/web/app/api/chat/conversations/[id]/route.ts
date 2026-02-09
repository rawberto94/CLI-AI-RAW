/**
 * Chat Conversation Detail API - Single conversation operations
 * 
 * GET /api/chat/conversations/[id] - Get conversation with messages
 * PATCH /api/chat/conversations/[id] - Update conversation
 * DELETE /api/chat/conversations/[id] - Delete conversation
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { aiCopilotService } from 'data-orchestration/services';

export const dynamic = 'force-dynamic';

// GET /api/chat/conversations/[id] - Get conversation with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  const tenantId = ctx.tenantId;

  try {
    const { id } = await params;
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
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// PATCH /api/chat/conversations/[id] - Update conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  const tenantId = ctx.tenantId;

  try {
    const { id } = await params;
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
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// DELETE /api/chat/conversations/[id] - Delete conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  const tenantId = ctx.tenantId;

  try {
    const { id } = await params;

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
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
