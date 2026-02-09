/**
 * MFA Setup API
 * Generate TOTP secret and QR code for enrollment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

import { prisma } from '@/lib/prisma';
import * as crypto from 'crypto';
import { auditTrailService } from 'data-orchestration/services';

// Generate a base32 secret for TOTP
function generateSecret(): string {
  const buffer = crypto.randomBytes(20);
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < buffer.length; i++) {
    secret += base32Chars[buffer[i] % 32];
  }
  return secret;
}

// Generate otpauth URL for QR code
function generateOTPAuthURL(secret: string, email: string, issuer: string = 'ConTigo'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

export const POST = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true },
    });

    if (!user) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
    }

    // Generate new secret
    const secret = generateSecret();
    const otpauthUrl = generateOTPAuthURL(secret, user.email);

    // Generate QR code URL using a public QR code service
    // In production, you'd generate this server-side with a library like qrcode
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

    // Store pending secret temporarily (expires in 10 minutes)
    // In production, store this securely with encryption
    await prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: {
        customSettings: {
          pendingMfaSecret: secret,
          pendingMfaExpires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      },
      create: {
        userId: user.id,
        customSettings: {
          pendingMfaSecret: secret,
          pendingMfaExpires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      },
    });

    return createSuccessResponse(ctx, {
      secret,
      qrCode: qrCodeUrl,
      otpauthUrl,
    });
  } catch (error) {
    console.error('Failed to setup MFA:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Internal server error', 500);
  }
});
