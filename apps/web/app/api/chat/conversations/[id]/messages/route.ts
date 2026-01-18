/**
 * Chat Messages API - Message operations within a conversation
 * 
 * GET /api/chat/conversations/[id]/messages - List messages in conversation
 * POST /api/chat/conversations/[id]/messages - Add message to conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// GET /api/chat/conversations/[id]/messages - List messages
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
    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
    const before = searchParams.get('before'); // Get messages before this timestamp
    const after = searchParams.get('after'); // Get messages after this timestamp

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
        skip: offset,
      }),
      prisma.chatMessage.count({ where: { conversationId } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        messages,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + messages.length < total,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/chat/conversations/[id]/messages - Add message
export async function POST(
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
    const { id: conversationId } = await params;
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

    const {
      role,
      content,
      toolCalls,
      toolResults,
      model,
      tokensUsed,
      responseTimeMs,
      metadata,
    } = body;

    if (!role || !content) {
      return NextResponse.json(
        { success: false, error: 'role and content are required' },
        { status: 400 }
      );
    }

    if (!['user', 'assistant', 'system', 'tool'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be user, assistant, system, or tool' },
        { status: 400 }
      );
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
        sources: toolCalls || toolResults ? JSON.stringify({ toolCalls, toolResults }) : undefined,
      },
    });

    // Update conversation's lastMessageAt
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: { message },
    });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create message' },
      { status: 500 }
    );
  }
}
