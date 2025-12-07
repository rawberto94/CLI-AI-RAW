import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/[id]
 * Get user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = await getApiTenantId(request);

    // Try database first
    try {
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
        return NextResponse.json({
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
    } catch (dbError) {
      console.warn('Database query failed:', dbError);
    }

    // Fallback mock user
    const mockUsers: Record<string, { id: string; name: string; email: string; role: string }> = {
      'user-1': { id: 'user-1', name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'admin' },
      'user-2': { id: 'user-2', name: 'Mike Johnson', email: 'mike.johnson@company.com', role: 'approver' },
      'user-3': { id: 'user-3', name: 'Emily Davis', email: 'emily.davis@company.com', role: 'legal' },
    };

    const mockUser = mockUsers[id];
    if (mockUser) {
      return NextResponse.json({
        success: true,
        user: {
          ...mockUser,
          avatar: null,
          initials: mockUser.name.split(' ').map(n => n[0]).join('').toUpperCase(),
        },
        source: 'mock',
      });
    }

    return NextResponse.json(
      { success: false, error: 'User not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
