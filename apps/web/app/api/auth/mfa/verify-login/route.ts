/**
 * MFA Login Verification API
 * 
 * POST /api/auth/mfa/verify-login
 * 
 * Verifies a TOTP code during the login flow (for users with MFA enabled).
 * Returns a signed verification token that the client uses to update the JWT session.
 * This route accepts requests from half-authenticated users (logged in but MFA pending).
 */

import { NextRequest } from "next/server";
import { auth, generateMfaVerificationToken } from "@/lib/auth";
import { verifyMFAToken } from "@/lib/security/mfa";
import { auditLog, AuditAction, getAuditContext } from "@/lib/security/audit";
import { getPublicApiContext, createSuccessResponse, createErrorResponse } from "@/lib/api-middleware";
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ctx = getPublicApiContext(request);

  try {
    // User must be authenticated (even if MFA-pending)
    const session = await auth();
    if (!session?.user?.id) {
      return createErrorResponse(ctx, "UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return createErrorResponse(ctx, "BAD_REQUEST", "Verification code is required", 400);
    }

    // Verify the TOTP or backup code
    const isValid = await verifyMFAToken(session.user.id, token.replace(/[\s-]/g, ""));

    if (isValid) {
      await auditLog({
        action: AuditAction.MFA_VERIFIED,
        userId: session.user.id,
        tenantId: session.user.tenantId,
        metadata: { flow: "login" },
        success: true,
        ...getAuditContext(request),
      }).catch(() => {});

      // Generate a signed token that the client sends via session update
      const mfaVerificationToken = generateMfaVerificationToken(session.user.id);

      return createSuccessResponse(ctx, {
        success: true,
        mfaVerificationToken,
      });
    }

    // Failed verification
    await auditLog({
      action: AuditAction.MFA_FAILED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      metadata: { flow: "login" },
      success: false,
      ...getAuditContext(request),
    }).catch(() => {});

    return createErrorResponse(ctx, "BAD_REQUEST", "Invalid verification code", 400);
  } catch (error) {
    logger.error("[MFA Verify Login] Error:", error);
    return createErrorResponse(ctx, "INTERNAL_ERROR", "Verification failed", 500);
  }
}
