/**
 * Admin Sessions API
 * Manage active user sessions across the organization
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuthApiHandler(async (request, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  // Get all sessions for users in this tenant
  const sessions = await prisma.userSession.findMany({
    where: {
      user: {
        tenantId: ctx.tenantId,
      },
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const currentToken = ctx.userSessionId;

  return createSuccessResponse(ctx, {
    sessions: sessions.map(s => ({
      id: s.id,
      userId: s.userId,
      userEmail: s.user.email,
      userName: `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() || s.user.email,
      ipAddress: s.ipAddress || 'Unknown',
      userAgent: s.userAgent || 'Unknown',
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrent: Boolean(currentToken) && s.token === currentToken,
    })),
  });
});

export const DELETE = withAuthApiHandler(async (request, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const currentToken = ctx.userSessionId;

  if (!currentToken) {
    return createSuccessResponse(ctx, {
      revokedCount: 0,
      warning: 'Current session could not be identified safely. Please sign in again before revoking sessions.',
    }, { status: 409 });
  }

  // Delete all sessions except current user's current session
  const result = await prisma.userSession.deleteMany({
    where: {
      user: {
        tenantId: ctx.tenantId,
      },
      NOT: {
        token: currentToken,
      },
    },
  });

  return createSuccessResponse(ctx, {
    revokedCount: result.count,
  });
});
