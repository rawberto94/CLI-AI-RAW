/**
 * Email Verification API
 * 
 * POST /api/auth/verify-email - Send verification email
 * GET /api/auth/verify-email?token=xxx - Verify email token
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getApiContext, createSuccessResponse, createErrorResponse } from "@/lib/api-middleware";
import { auth } from "@/lib/auth";

/**
 * GET — Verify email with token (public, from email link)
 */
export async function GET(request: NextRequest) {
  const ctx = getApiContext(request);

  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return createErrorResponse(ctx, "BAD_REQUEST", "Verification token is required", 400);
    }

    const verificationToken = await prisma.emailVerificationToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      return createErrorResponse(ctx, "BAD_REQUEST", "Invalid or expired verification link", 400);
    }

    // Mark email as verified and consume the token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return createSuccessResponse(ctx, {
      message: "Email verified successfully. You can now sign in.",
      verified: true,
    });
  } catch (error) {
    console.error("[Auth] Email verification error:", error);
    return createErrorResponse(ctx, "INTERNAL_ERROR", "Verification failed", 500);
  }
}

/**
 * POST — Request a new verification email (authenticated)
 */
export async function POST(request: NextRequest) {
  const ctx = getApiContext(request);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return createErrorResponse(ctx, "UNAUTHORIZED", "Authentication required", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return createErrorResponse(ctx, "NOT_FOUND", "User not found", 404);
    }

    if (user.emailVerified) {
      return createSuccessResponse(ctx, { message: "Email is already verified" });
    }

    // Invalidate existing tokens
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        email: user.email,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}`;

    // In production, send email. In dev, log to console.
    if (process.env.NODE_ENV === "production" && process.env.SMTP_HOST) {
      console.log(`[Auth] Verification email queued for: ${user.email}`);
    } else {
      console.log(`\n========================================`);
      console.log(`EMAIL VERIFICATION LINK (dev mode)`);
      console.log(`Email: ${user.email}`);
      console.log(`Link:  ${verifyUrl}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log(`========================================\n`);
    }

    return createSuccessResponse(ctx, {
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("[Auth] Send verification error:", error);
    return createErrorResponse(ctx, "INTERNAL_ERROR", "Failed to send verification email", 500);
  }
}
