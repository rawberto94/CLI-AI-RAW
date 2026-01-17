/**
 * Message Feedback API - Update feedback on individual messages
 * 
 * PATCH /api/chat/conversations/[id]/messages/[messageId] - Update message feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// PATCH /api/chat/conversations/[id]/messages/[messageId] - Update message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { id: conversationId, messageId } = await params;
    const body = await request.json();

    // Verify conversation ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, tenantId, userId: session.user.id },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify message belongs to conversation
    const existingMessage = await prisma.chatMessage.findFirst({
      where: { id: messageId, conversationId },
    });

    if (!existingMessage) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    const { feedback, feedbackComment, metadata } = body;

    const updateData: Record<string, unknown> = {};
    
    if (feedback !== undefined) {
      if (feedback !== null && !['positive', 'negative'].includes(feedback)) {
        return NextResponse.json(
          { success: false, error: 'Invalid feedback. Must be positive, negative, or null' },
          { status: 400 }
        );
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
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { message },
    });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update message' },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/conversations/[id]/messages/[messageId] - Delete message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { id: conversationId, messageId } = await params;

    // Verify conversation ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, tenantId, userId: session.user.id },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify message belongs to conversation
    const existingMessage = await prisma.chatMessage.findFirst({
      where: { id: messageId, conversationId },
    });

    if (!existingMessage) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    await prisma.chatMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({
      success: true,
      message: 'Message deleted',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
