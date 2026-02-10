/**
 * User Profile API - Current user profile management
 * 
 * GET /api/user/profile - Get current user's profile
 * PATCH /api/user/profile - Update current user's profile
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { auditTrailService } from 'data-orchestration/services';
export const dynamic = 'force-dynamic';

// GET /api/user/profile - Get current user's profile
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = await ctx.tenantId;

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, tenantId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      avatar: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
  }

  // Format response
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 
               user.email?.split('@')[0] || 'Unknown';

  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      user: {
        id: user.id,
        name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar,
        initials,
        role: user.role || 'member',
        company: user.tenant?.name,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    },
  });
});

// PATCH /api/user/profile - Update current user's profile
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = await ctx.tenantId;
  const body = await request.json();

  // Verify user exists
  const existingUser = await prisma.user.findFirst({
    where: { id: session.user.id, tenantId },
  });

  if (!existingUser) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
  }

  // Allowed fields to update
  const {
    firstName,
    lastName,
    avatar,
  } = body;

  const updateData: Record<string, unknown> = {};

  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (avatar !== undefined) updateData.avatar = avatar;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      avatar: true,
      updatedAt: true,
    },
  });

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 
               user.email?.split('@')[0] || 'Unknown';

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      user: {
        ...user,
        name,
        initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      },
    },
    message: 'Profile updated successfully',
  });
});
