/**
 * Reset Password API
 * 
 * POST /api/auth/reset-password
 * 
 * Accepts a valid reset token + new password and updates the user's password.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import { auditLog, AuditAction } from "@/lib/security/audit";
import { getPublicApiContext, createSuccessResponse, createErrorResponse } from "@/lib/api-middleware";
import { logger } from '@/lib/logger';

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export async function POST(request: NextRequest) {
  const ctx = getPublicApiContext(request);

  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // Find valid, unused token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      return createErrorResponse(ctx, "BAD_REQUEST", "Invalid or expired reset link. Please request a new one.", 400);
    }

    // Hash the new password
    const passwordHash = await hash(password, 12);

    // Update password and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all other reset tokens for this user
      prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, id: { not: resetToken.id }, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    await auditLog({
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      userId: resetToken.userId,
      metadata: {},
      success: true,
    }).catch(() => {});

    return createSuccessResponse(ctx, {
      message: "Password has been reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, "VALIDATION_ERROR", error.errors[0]?.message || "Invalid input", 400);
    }
    logger.error("[Auth] Reset password error:", error);
    return createErrorResponse(ctx, "INTERNAL_ERROR", "Password reset failed", 500);
  }
}
