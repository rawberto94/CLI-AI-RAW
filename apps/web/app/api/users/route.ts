import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { auditTrailService } from 'data-orchestration/services';
export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * List users for delegation, sharing, @mentions
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const role = searchParams.get('role');
  const limit = parseInt(searchParams.get('limit') || '20');
  const excludeUserId = searchParams.get('exclude');

  // Try database first
  try {
    const whereClause: Record<string, unknown> = {
      tenantId,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    if (excludeUserId) {
      whereClause.id = { not: excludeUserId };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
      },
      take: limit,
      orderBy: { firstName: 'asc' },
    });

    return createSuccessResponse(ctx, {
      success: true,
      users: users.map(u => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email?.split('@')[0] || 'Unknown';
        return {
          id: u.id,
          name,
          email: u.email,
          role: u.role || 'member',
          avatar: u.avatar,
          initials: name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2),
        };
      }),
      source: 'database',
    });
  } catch (_dbError) {
    // Database query failed - return error, not mock data
    return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'Database connection failed', 503);
  }
});

/**
 * GET /api/users/[id] is handled by dynamic route
 * This endpoint is for listing/searching users
 */
