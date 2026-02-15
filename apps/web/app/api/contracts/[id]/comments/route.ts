import { NextRequest } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/:id/comments
 * Get all comments for a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const tenantId = await getApiTenantId(request);

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

      // Collect all user IDs from comments and replies
      const userIds = new Set<string>();
      comments.forEach(comment => {
        userIds.add(comment.userId);
        comment.replies?.forEach(reply => userIds.add(reply.userId));
      });

      // Fetch user info for all comment authors
      const users = await db.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, email: true, firstName: true, lastName: true }
      });
      
      // Create lookup map for users
      const userMap = new Map(users.map(u => [u.id, u]));
      const getUserInfo = (userId: string) => {
        const user = userMap.get(userId);
        if (user) {
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];
          return { author: fullName, authorEmail: user.email };
        }
        return { author: userId, authorEmail: `${userId}@unknown.com` };
      };

      // Transform to frontend format
      const formattedComments = comments.map(comment => {
        const userInfo = getUserInfo(comment.userId);
        return {
          id: comment.id,
          author: userInfo.author,
          authorEmail: userInfo.authorEmail,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          mentions: comment.mentions,
          isResolved: comment.isResolved,
          likes: comment.likes,
          replies: comment.replies?.map(reply => {
            const replyUserInfo = getUserInfo(reply.userId);
            return {
              id: reply.id,
              author: replyUserInfo.author,
              authorEmail: replyUserInfo.authorEmail,
              content: reply.content,
              createdAt: reply.createdAt.toISOString(),
              mentions: reply.mentions,
              isResolved: reply.isResolved,
              likes: reply.likes,
            };
          }) || []
        };
      });

      return createSuccessResponse(ctx, {
        success: true,
        comments: formattedComments,
        source: 'database'
      });

    } catch (error) {
      return handleApiError(ctx, error);
    }

  } catch (error: unknown) {
    return handleApiError(ctx, error);
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
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const tenantId = await getApiTenantId(request);
    const body = await request.json();
    const { content, author, authorEmail, parentId, mentions } = body;

    if (!content || !author) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Content and author are required', 400);
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

      return createSuccessResponse(ctx, {
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

    } catch (error) {
      return handleApiError(ctx, error);
    }

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
