import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { auditTrailService } from 'data-orchestration/services';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/[id]
 * Get user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
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
    } catch (error) {
      throw error;
    }

    return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
