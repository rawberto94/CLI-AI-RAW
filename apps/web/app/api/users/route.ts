import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * List users for delegation, sharing, @mentions
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
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
      console.warn('Database query failed, using mock users:', dbError);
    }

    // Fallback mock users
    const mockUsers = [
      { id: 'user-1', name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'admin', avatar: null, initials: 'SC' },
      { id: 'user-2', name: 'Mike Johnson', email: 'mike.johnson@company.com', role: 'approver', avatar: null, initials: 'MJ' },
      { id: 'user-3', name: 'Emily Davis', email: 'emily.davis@company.com', role: 'legal', avatar: null, initials: 'ED' },
      { id: 'user-4', name: 'James Wilson', email: 'james.wilson@company.com', role: 'finance', avatar: null, initials: 'JW' },
      { id: 'user-5', name: 'Alex Martinez', email: 'alex.martinez@company.com', role: 'member', avatar: null, initials: 'AM' },
      { id: 'user-6', name: 'Lisa Park', email: 'lisa.park@company.com', role: 'member', avatar: null, initials: 'LP' },
      { id: 'user-7', name: 'Tom Williams', email: 'tom.williams@company.com', role: 'manager', avatar: null, initials: 'TW' },
      { id: 'user-8', name: 'Jane Smith', email: 'jane.smith@company.com', role: 'legal', avatar: null, initials: 'JS' },
    ];

    let filteredUsers = [...mockUsers];

    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        u => u.name.toLowerCase().includes(searchLower) || u.email.toLowerCase().includes(searchLower)
      );
    }

    if (role) {
      filteredUsers = filteredUsers.filter(u => u.role === role);
    }

    if (excludeUserId) {
      filteredUsers = filteredUsers.filter(u => u.id !== excludeUserId);
    }

    return NextResponse.json({
      success: true,
      users: filteredUsers.slice(0, limit),
      source: 'mock',
    });
  } catch (error) {
    console.error('Error fetching users:', error);
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
