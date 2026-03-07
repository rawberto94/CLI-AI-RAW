/**
 * Admin Sessions API
 * Manage active user sessions across the organization
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (request, ctx) => {
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

  // Get current session token for comparison
  const currentToken = request.cookies.get('next-auth.session-token')?.value;

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
      isCurrent: s.token === currentToken,
    })),
  });
});

export const DELETE = withAuthApiHandler(async (request, ctx) => {
  const currentToken = request.cookies.get('next-auth.session-token')?.value;

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
