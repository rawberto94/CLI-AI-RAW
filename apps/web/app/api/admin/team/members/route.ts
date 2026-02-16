/**
 * Team Members Admin API
 * List and manage team members
 */

import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (_request, ctx) => {
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
