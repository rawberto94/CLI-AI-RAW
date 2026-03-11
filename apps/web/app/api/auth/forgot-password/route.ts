/**
 * Forgot Password API
 * 
 * POST /api/auth/forgot-password
 * 
 * Generates a password reset token and "sends" it via email.
 * In development, the reset link is logged to the console.
 * Always returns 200 to prevent email enumeration.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { z } from "zod";
import { auditLog, AuditAction } from "@/lib/security/audit";
import { getPublicApiContext, createSuccessResponse, createErrorResponse } from "@/lib/api-middleware";
import { sendEmail } from "@/lib/email/email-service";
import { logger } from '@/lib/logger';

const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export async function POST(request: NextRequest) {
  const ctx = getPublicApiContext(request);

  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Always respond with success to prevent email enumeration
    const successMsg = "If an account exists with this email, you will receive a password reset link.";

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, tenantId: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      // Don't reveal whether the user exists
      return createSuccessResponse(ctx, { message: successMsg });
    }

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (!baseUrl) {
      throw new Error('NEXT_PUBLIC_APP_URL or NEXTAUTH_URL environment variable must be configured');
    }
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    // In production, send email. In dev, log to console.
    if (process.env.NODE_ENV === "production") {
      if (!process.env.SMTP_HOST && !process.env.SENDGRID_API_KEY && !process.env.RESEND_API_KEY) {
        logger.error(`[Auth] CRITICAL: No email provider configured (SMTP_HOST, SENDGRID_API_KEY, or RESEND_API_KEY). Password reset email NOT sent for: ${email}`);
        // Still return success to prevent user enumeration, but log the failure
      } else {
        const emailSent = await sendEmail({
          to: email,
          subject: 'Reset Your ConTigo Password',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a1a1a;">Password Reset Request</h2>
              <p>You requested a password reset for your ConTigo account. Click the button below to set a new password.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Reset Password
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this reset, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #999; font-size: 12px;">ConTigo CLM Platform</p>
            </div>
          `,
          text: `Password Reset Request\n\nYou requested a password reset. Visit this link to set a new password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
        });
        if (!emailSent) {
          logger.error(`[Auth] Failed to send password reset email to: ${email}`);
        }
      }
    } else {
      logger.info('PASSWORD RESET LINK (dev mode)', { action: 'password-reset', email, resetUrl, expiresAt: expiresAt.toISOString() });
    }

    await auditLog({
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      userId: user.id,
      userEmail: email,
      tenantId: user.tenantId,
      metadata: { expiresAt: expiresAt.toISOString() },
      success: true,
    }).catch(() => {});

    return createSuccessResponse(ctx, { message: successMsg });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, "VALIDATION_ERROR", error.errors[0]?.message || "Invalid input", 400);
    }
    logger.error("[Auth] Forgot password error:", error);
    return createErrorResponse(ctx, "INTERNAL_ERROR", "An error occurred", 500);
  }
}
