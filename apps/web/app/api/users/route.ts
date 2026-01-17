import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * List users for delegation, sharing, @mentions
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
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

      return NextResponse.json({
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
    } catch (dbError) {
      // Database query failed - return error, not mock data
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/[id] is handled by dynamic route
 * This endpoint is for listing/searching users
 */
