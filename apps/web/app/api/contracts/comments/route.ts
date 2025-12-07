/**
 * Contract Comments API
 * CRUD operations for contract comments
 */

import { NextRequest, NextResponse } from 'next/server';

interface Comment {
  id: string;
  contractId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
  updatedAt?: string;
  isPinned: boolean;
  isResolved: boolean;
  parentId?: string;
  reactions: { emoji: string; userIds: string[] }[];
  pageReference?: number;
  clauseReference?: string;
}

// In-memory storage for demo (would use database in production)
const comments: Map<string, Comment[]> = new Map();

// Helper to get or initialize contract comments
function getContractComments(contractId: string): Comment[] {
  if (!comments.has(contractId)) {
    comments.set(contractId, []);
  }
  return comments.get(contractId)!;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const filter = searchParams.get('filter') || 'all';
    
    if (!contractId) {
      return NextResponse.json(
        { error: 'contractId is required' },
        { status: 400 }
      );
    }

    let contractComments = getContractComments(contractId);

    // Apply filters
    if (filter === 'unresolved') {
      contractComments = contractComments.filter(c => !c.isResolved);
    } else if (filter === 'pinned') {
      contractComments = contractComments.filter(c => c.isPinned);
    }

    // Sort by pinned first, then by date
    contractComments.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      comments: contractComments,
      total: contractComments.length,
      unresolved: contractComments.filter(c => !c.isResolved).length,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      contractId, 
      content, 
      authorId, 
      authorName, 
      authorEmail,
      parentId,
      pageReference,
      clauseReference,
    } = body;

    if (!contractId || !content || !authorId) {
      return NextResponse.json(
        { error: 'contractId, content, and authorId are required' },
        { status: 400 }
      );
    }

    const comment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      contractId,
      content,
      authorId,
      authorName: authorName || 'Unknown User',
      authorEmail: authorEmail || '',
      createdAt: new Date().toISOString(),
      isPinned: false,
      isResolved: false,
      parentId,
      reactions: [],
      pageReference,
      clauseReference,
    };

    const contractComments = getContractComments(contractId);
    contractComments.push(comment);

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { commentId, contractId, content, isPinned, isResolved } = body;

    if (!commentId || !contractId) {
      return NextResponse.json(
        { error: 'commentId and contractId are required' },
        { status: 400 }
      );
    }

    const contractComments = getContractComments(contractId);
    const index = contractComments.findIndex(c => c.id === commentId);

    if (index === -1) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    const updatedComment: Comment = {
      ...contractComments[index],
      ...(content !== undefined && { content, updatedAt: new Date().toISOString() }),
      ...(isPinned !== undefined && { isPinned }),
      ...(isResolved !== undefined && { isResolved }),
    } as Comment;

    contractComments[index] = updatedComment;

    return NextResponse.json({ comment: updatedComment });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');
    const contractId = searchParams.get('contractId');

    if (!commentId || !contractId) {
      return NextResponse.json(
        { error: 'commentId and contractId are required' },
        { status: 400 }
      );
    }

    const contractComments = getContractComments(contractId);
    const index = contractComments.findIndex(c => c.id === commentId);

    if (index === -1) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Also remove any replies to this comment
    const filtered = contractComments.filter(
      c => c.id !== commentId && c.parentId !== commentId
    );
    comments.set(contractId, filtered);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
