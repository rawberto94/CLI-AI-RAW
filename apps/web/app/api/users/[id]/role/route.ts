/**
 * User Role Management API
 */

import { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { auditTrailService } from 'data-orchestration/services';

const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

// PUT - Update user's role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession();
    const { id: userId } = await params;

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true },
    });

    if (!currentUser || !['admin', 'owner'].includes(currentUser.role)) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !VALID_ROLES.includes(role)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid role. Must be one of: ', 400);
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, role: true, email: true },
    });

    if (!targetUser || targetUser.tenantId !== currentUser.tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
    }

    // Cannot change owner role unless you're also owner
    if (targetUser.role === 'owner' && currentUser.role !== 'owner') {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Only owners can change owner roles', 403);
    }

    // Cannot promote to owner unless you're owner
    if (role === 'owner' && currentUser.role !== 'owner') {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Only owners can promote to owner', 403);
    }

    // Cannot demote yourself
    if (targetUser.id === session.user.id && role !== currentUser.role) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Cannot change your own role', 400);
    }

    // Update role
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        tenantId: currentUser.tenantId,
        userId: session.user.id,
        action: 'USER_ROLE_CHANGED',
        resourceType: 'user',
        resource: userId,
        details: {
          targetEmail: targetUser.email,
          previousRole: targetUser.role,
          newRole: role,
        },
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      userId,
      role,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
