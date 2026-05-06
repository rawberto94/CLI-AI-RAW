/**
 * Verify Invite Token API
 * Validates invitation tokens and returns tenant info
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditTrailService } from 'data-orchestration/services';
import { getPublicApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
  const ctx = getPublicApiContext(request);
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return createErrorResponse(
        ctx, 'BAD_REQUEST',
        "Token is required",
        400
      );
    }

    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        token,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return createSuccessResponse(ctx, {
        valid: false,
        error: "Invalid or expired invitation",
      });
    }

    return createSuccessResponse(ctx, {
      valid: true,
      email: invitation.email,
      tenantName: invitation.tenant.name,
      role: invitation.role,
    });
  } catch {
    return createErrorResponse(
      ctx, 'INTERNAL_ERROR',
      "Failed to verify invitation",
      500
    );
  }
}
