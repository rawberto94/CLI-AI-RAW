/**
 * MFA Verify API
 * Verify TOTP code and enable MFA
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import * as crypto from 'crypto';

// TOTP verification (simplified - in production use a library like otplib)
function verifyTOTP(secret: string, code: string): boolean {
  const timeStep = 30;
  const digits = 6;
  
  // Check current and adjacent time windows
  for (let window = -1; window <= 1; window++) {
    const counter = Math.floor((Date.now() / 1000 + window * timeStep) / timeStep);
    const expectedCode = generateTOTP(secret, counter, digits);
    if (expectedCode === code) {
      return true;
    }
  }
  return false;
}

function generateTOTP(secret: string, counter: number, digits: number): string {
  // Decode base32 secret
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret) {
    const val = base32Chars.indexOf(char.toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const secretBytes = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < secretBytes.length; i++) {
    secretBytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }

  // Generate HMAC
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  
  const hmac = crypto.createHmac('sha1', secretBytes);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = 
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, secret } = body;

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }

    // Get user preferences with pending secret
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    });

    const settings = preferences?.settings as any || {};
    const pendingSecret = secret || settings.pendingMfaSecret;
    const pendingExpires = settings.pendingMfaExpires;

    if (!pendingSecret) {
      return NextResponse.json(
        { error: 'No pending MFA setup. Please start setup again.' },
        { status: 400 }
      );
    }

    if (pendingExpires && new Date(pendingExpires) < new Date()) {
      return NextResponse.json(
        { error: 'MFA setup expired. Please start again.' },
        { status: 400 }
      );
    }

    // Verify the code
    if (!verifyTOTP(pendingSecret, code)) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Enable MFA
    await prisma.userPreferences.update({
      where: { userId: session.user.id },
      data: {
        settings: {
          ...settings,
          mfa: {
            enabled: true,
            method: 'totp',
            secret: pendingSecret, // In production, encrypt this!
            enrolledAt: new Date().toISOString(),
          },
          pendingMfaSecret: null,
          pendingMfaExpires: null,
        },
      },
    });

    // Log the event
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (user) {
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: session.user.id,
          action: 'MFA_ENABLED',
          resourceType: 'user',
          resourceId: session.user.id,
          details: { method: 'totp' },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to verify MFA:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
