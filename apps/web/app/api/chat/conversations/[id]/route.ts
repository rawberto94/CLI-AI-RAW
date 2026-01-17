/**
 * Chat Conversation Detail API - Single conversation operations
 * 
 * GET /api/chat/conversations/[id] - Get conversation with messages
 * PATCH /api/chat/conversations/[id] - Update conversation
 * DELETE /api/chat/conversations/[id] - Delete conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// GET /api/chat/conversations/[id] - Get conversation with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const messageLimit = parseInt(searchParams.get('messageLimit') || '50');
    const messageOffset = parseInt(searchParams.get('messageOffset') || '0');

    const conversation = await prisma.chatConversation.findFirst({
      where: { id, tenantId, userId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: messageLimit,
          skip: messageOffset,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

// PATCH /api/chat/conversations/[id] - Update conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.chatConversation.findFirst({
      where: { id, tenantId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const { title, isPinned, isArchived } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    const conversation = await prisma.chatConversation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/conversations/[id] - Delete conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.chatConversation.findFirst({
      where: { id, tenantId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Delete conversation (cascades to messages)
    await prisma.chatConversation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
