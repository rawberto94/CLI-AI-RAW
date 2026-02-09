/**
 * MFA Disable API
 * Disable MFA for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';

export const POST = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    // Check if user has MFA enabled
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mfaEnabled: true, tenantId: true },
    });

    if (!user?.mfaEnabled) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'MFA not enabled', 400);
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaPendingSecret: null,
        mfaPendingBackupCodes: [],
        mfaEnabledAt: null,
      },
    });

    // Log the event
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: session.user.id,
        action: 'MFA_DISABLED',
        resourceType: 'user',
        resource: session.user.id,
        details: {},
      },
    });

    return createSuccessResponse(ctx, { success: true });
  } catch (error) {
    console.error('Failed to disable MFA:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Internal server error', 500);
  }
});
