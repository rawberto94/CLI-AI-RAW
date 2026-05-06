/**
 * Team Members Admin API
 * List and manage team members
 */

import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringService } from 'data-orchestration/services';

function canManageTeam(userRole: string | undefined): boolean {
  return userRole === 'owner' || userRole === 'admin' || userRole === 'superadmin';
}

export const GET = withAuthApiHandler(async (_request, ctx) => {
  if (!canManageTeam(ctx.userRole)) {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        retryable: false,
      },
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': ctx.requestId,
        'X-Response-Time': `${Date.now() - ctx.startTime}ms`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const members = await prisma.user.findMany({
    where: { tenantId: ctx.tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: [
      { role: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return createSuccessResponse(ctx, { members });
});
