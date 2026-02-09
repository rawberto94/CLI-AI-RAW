/**
 * MFA Status API
 * Check if MFA is enabled for the current user
 */

import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true,
        email: true,
        mfaEnabled: true,
        mfaEnabledAt: true,
      },
    });

    if (!user) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
    }

    return createSuccessResponse(ctx, {
      enabled: user.mfaEnabled,
      method: user.mfaEnabled ? 'totp' : null,
      enrolledAt: user.mfaEnabledAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('Failed to get MFA status:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Internal server error', 500);
  }
});
