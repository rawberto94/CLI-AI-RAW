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

type EmailPreferences = {
  renewals: boolean;
  risks: boolean;
  savings: boolean;
  weekly: boolean;
};

const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  renewals: true,
  risks: true,
  savings: true,
  weekly: true,
};

function normalizeEmailPreferences(raw: unknown): EmailPreferences {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (((raw as Record<string, unknown>).email as Record<string, unknown> | undefined) ?? raw as Record<string, unknown>)
    : {};

  return {
    renewals: typeof source.renewals === 'boolean' ? source.renewals : DEFAULT_EMAIL_PREFERENCES.renewals,
    risks: typeof source.risks === 'boolean' ? source.risks : DEFAULT_EMAIL_PREFERENCES.risks,
    savings: typeof source.savings === 'boolean' ? source.savings : DEFAULT_EMAIL_PREFERENCES.savings,
    weekly: typeof source.weekly === 'boolean' ? source.weekly : DEFAULT_EMAIL_PREFERENCES.weekly,
  };
}

// GET /api/user/profile - Get current user's profile
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;

  const user = await prisma.user.findFirst({
    where: { id: ctx.userId, tenantId },
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
      preferences: {
        select: {
          notifications: true,
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
  const emailPreferences = normalizeEmailPreferences(user.preferences?.notifications);

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
        emailPreferences,
      },
    },
  });
});

// PATCH /api/user/profile - Update current user's profile
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const body = await request.json();

  // Verify user exists
  const existingUser = await prisma.user.findFirst({
    where: { id: ctx.userId, tenantId },
    include: {
      preferences: {
        select: {
          notifications: true,
        },
      },
    },
  });

  if (!existingUser) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
  }

  // Allowed fields to update
  const {
    firstName,
    lastName,
    avatar,
    emailPreferences,
  } = body;

  const updateData: Record<string, unknown> = {};

  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (avatar !== undefined) updateData.avatar = avatar;

  const nextEmailPreferences = emailPreferences !== undefined
    ? normalizeEmailPreferences(emailPreferences)
    : normalizeEmailPreferences(existingUser.preferences?.notifications);
  const existingNotifications = existingUser.preferences?.notifications && typeof existingUser.preferences.notifications === 'object' && !Array.isArray(existingUser.preferences.notifications)
    ? existingUser.preferences.notifications as Record<string, unknown>
    : {};
  const mergedNotifications = {
    ...existingNotifications,
    email: nextEmailPreferences,
  };

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: ctx.userId },
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
    }),
    prisma.userPreferences.upsert({
      where: { userId: ctx.userId },
      update: {
        notifications: mergedNotifications,
      },
      create: {
        userId: ctx.userId,
        notifications: mergedNotifications,
      },
    }),
  ]);

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 
               user.email?.split('@')[0] || 'Unknown';

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      user: {
        ...user,
        name,
        initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
        emailPreferences: nextEmailPreferences,
      },
    },
    message: 'Profile updated successfully',
  });
});
