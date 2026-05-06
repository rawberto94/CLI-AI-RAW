import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/[id]
 * Get user by ID
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };
  const tenantId = ctx.tenantId;

  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      avatar: true,
      createdAt: true,
    },
  });

  if (user) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email?.split('@')[0] || 'Unknown';
    return createSuccessResponse(ctx, {
      success: true,
      user: {
        id: user.id,
        name,
        email: user.email,
        role: user.role || 'member',
        avatar: user.avatar,
        initials: name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
      },
      source: 'database',
    });
  }

  return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
})
