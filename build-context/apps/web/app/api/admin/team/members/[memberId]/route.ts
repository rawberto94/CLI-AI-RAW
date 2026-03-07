/**
 * Individual Team Member Admin API
 * Update and delete team members
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { memberId } = await params;

    // Get target member
    const member = await prisma.user.findFirst({
      where: { 
        id: memberId,
        tenantId: ctx.tenantId,
      },
    });

    if (!member) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Member not found', 404);
    }

    // Cannot modify owner unless you are owner
    if (member.role === 'owner' && ctx.userRole !== 'owner') {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Cannot modify organization owner', 403);
    }

    const body = await request.json();
    const { role, status } = body;

    // Only owner can assign owner role
    if (role === 'owner' && ctx.userRole !== 'owner') {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Only owners can assign owner role', 403);
    }

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: {
        ...(role && { role }),
        ...(status && { status }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'MEMBER_UPDATED',
        entityType: 'USER',
        entityId: memberId,
        metadata: { role, status },
      },
    });

    return createSuccessResponse(ctx, { member: updatedMember });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { memberId } = await params;

    // Get target member
    const member = await prisma.user.findFirst({
      where: { 
        id: memberId,
        tenantId: ctx.tenantId,
      },
    });

    if (!member) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Member not found', 404);
    }

    // Cannot delete owner
    if (member.role === 'owner') {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Cannot delete organization owner', 403);
    }

    // Cannot delete yourself
    if (member.id === ctx.userId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Cannot delete your own account', 400);
    }

    await prisma.user.delete({
      where: { id: memberId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'MEMBER_REMOVED',
        entityType: 'USER',
        entityId: memberId,
        metadata: { email: member.email },
      },
    });

    return createSuccessResponse(ctx, {});
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
