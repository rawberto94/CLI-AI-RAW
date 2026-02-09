/**
 * Admin Session Management - Single Session
 */

import { NextRequest } from 'next/server';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringService } from 'data-orchestration/services';

// DELETE - Revoke a specific session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const ctx = getApiContext(request);
  try {
    // Verify the session belongs to a user in the same tenant
    const targetSession = await prisma.userSession.findUnique({
      where: { id: params.sessionId },
      include: {
        user: {
          select: { tenantId: true },
        },
      },
    });

    if (!targetSession || targetSession.user.tenantId !== ctx.tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Session not found', 404);
    }

    await prisma.userSession.delete({
      where: { id: params.sessionId },
    });

    return createSuccessResponse(ctx, {});
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
