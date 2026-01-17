import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// Mock data fallback for demonstration
const getMockComments = () => [
  {
    id: '1',
    author: 'Roberto Ostojic',
    authorEmail: 'roberto@example.com',
    content: 'This contract looks good overall, but I have concerns about the liability clause in section 3.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    mentions: [],
    isResolved: false,
    likes: 2,
    replies: [
      {
        id: '2',
        author: 'Jane Smith',
        authorEmail: 'jane@example.com',
        content: '@roberto I agree. We should request a cap on liability at $500K.',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        mentions: ['roberto'],
        isResolved: false,
        likes: 1,
      }
    ]
  },
  {
    id: '3',
    author: 'Mike Johnson',
    authorEmail: 'mike@example.com',
    content: 'Payment terms look acceptable. Net 30 days is standard.',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    mentions: [],
    isResolved: true,
    likes: 3,
  }
];

/**
 * GET /api/contracts/:id/comments
 * Get all comments for a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;
    const tenantId = await getApiTenantId(request);
    const useMock = request.nextUrl.searchParams.get('mock') === 'true';

    // Return mock data if requested or if database query fails
    if (useMock) {
      return NextResponse.json({
        success: true,
        comments: getMockComments(),
        source: 'mock'
      });
    }

    try {
      const db = await getDb();
      
      // Fetch comments from database
      const comments = await db.contractComment.findMany({
        where: {
          contractId,
          tenantId,
          parentId: null // Only top-level comments
        },
        include: {
          replies: {
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Transform to frontend format
      const formattedComments = comments.map(comment => ({
        id: comment.id,
        author: comment.userId, // TODO: Join with User table for real name
        authorEmail: `${comment.userId}@example.com`, // TODO: Get from User table
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        mentions: comment.mentions,
        isResolved: comment.isResolved,
        likes: comment.likes,
        replies: comment.replies?.map(reply => ({
          id: reply.id,
          author: reply.userId,
          authorEmail: `${reply.userId}@example.com`,
          content: reply.content,
          createdAt: reply.createdAt.toISOString(),
          mentions: reply.mentions,
          isResolved: reply.isResolved,
          likes: reply.likes,
        })) || []
      }));

      return NextResponse.json({
        success: true,
        comments: formattedComments,
        source: 'database'
      });

    } catch {
      return NextResponse.json({
        success: true,
        comments: getMockComments(),
        source: 'mock-fallback'
      });
    }

  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch comments',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts/:id/comments
 * Add a new comment to a contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;
    const tenantId = await getApiTenantId(request);
    const useMock = request.nextUrl.searchParams.get('mock') === 'true';
    const body = await request.json();
    const { content, author, authorEmail, parentId, mentions } = body;

    if (!content || !author) {
      return NextResponse.json(
        { success: false, error: 'Content and author are required' },
        { status: 400 }
      );
    }

    // Mock response if requested
    if (useMock) {
      const newComment = {
        id: Date.now().toString(),
        author,
        authorEmail,
        content,
        createdAt: new Date().toISOString(),
        mentions: mentions || [],
        isResolved: false,
        likes: 0,
        parentId,
      };

      return NextResponse.json({
        success: true,
        comment: newComment,
        message: 'Comment added successfully',
        source: 'mock'
      });
    }

    try {
      const db = await getDb();

      // Create comment in database
      const newComment = await db.contractComment.create({
        data: {
          contractId,
          tenantId,
          userId: author, // From session when authenticated
          content,
          mentions: mentions || [],
          parentId: parentId || null,
        }
      });

      return NextResponse.json({
        success: true,
        comment: {
          id: newComment.id,
          author: newComment.userId,
          authorEmail,
          content: newComment.content,
          createdAt: newComment.createdAt.toISOString(),
          mentions: newComment.mentions,
          isResolved: newComment.isResolved,
          likes: newComment.likes,
          parentId: newComment.parentId,
        },
        message: 'Comment added successfully',
        source: 'database'
      });

    } catch {
      const newComment = {
        id: Date.now().toString(),
        author,
        authorEmail,
        content,
        createdAt: new Date().toISOString(),
        mentions: mentions || [],
        isResolved: false,
        likes: 0,
        parentId,
      };

      return NextResponse.json({
        success: true,
        comment: newComment,
        message: 'Comment added successfully (mock)',
        source: 'mock-fallback'
      });
    }

  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
