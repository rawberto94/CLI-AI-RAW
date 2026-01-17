/**
 * Chat Conversations API - Persist AI Copilot chat history
 * 
 * GET /api/chat/conversations - List user's conversations
 * POST /api/chat/conversations - Create a new conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// GET /api/chat/conversations - List conversations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const { searchParams } = new URL(request.url);
    
    const contextType = searchParams.get('contextType');
    const context = searchParams.get('context');
    const archived = searchParams.get('archived') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {
      tenantId,
      userId: session.user.id,
      isArchived: archived,
    };

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
            createdAt: true,
          },
        },
      },
    });

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
      updatedAt: conv.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        conversations: formattedConversations,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

// POST /api/chat/conversations - Create conversation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = await getApiTenantId(request);
    const body = await request.json();

    const {
      title,
      context,
      contextType = 'GENERAL',
    } = body;

    const conversation = await prisma.chatConversation.create({
      data: {
        tenantId,
        userId: session.user.id,
        title: title || 'New Conversation',
        context,
        contextType,
        messageCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
