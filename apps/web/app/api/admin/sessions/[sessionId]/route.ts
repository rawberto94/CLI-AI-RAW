/**
 * Admin Session Management - Single Session
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringService } from 'data-orchestration/services';

// DELETE - Revoke a specific session
export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const { sessionId } = await (ctx as any).params as { sessionId: string };

    // Verify the session belongs to a user in the same tenant
    const targetSession = await prisma.userSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { tenantId: true },
        },
      },
    });

    if (!targetSession || targetSession.user.tenantId !== ctx.tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Session not found', 404);
    }

    if (ctx.userSessionId && targetSession.userId === ctx.userId && targetSession.token === ctx.userSessionId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Cannot revoke current session', 400);
    }

    await prisma.userSession.delete({
      where: { id: sessionId },
    });

    return createSuccessResponse(ctx, {});
  } catch (error) {
    return handleApiError(ctx, error);
  }
})
