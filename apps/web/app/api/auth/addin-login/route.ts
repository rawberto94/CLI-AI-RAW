/**
 * Word Add-in Login API
 * Provides authentication for the Word Add-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { compare, hash } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('CRITICAL: JWT_SECRET or NEXTAUTH_SECRET must be configured for Word Add-in authentication');
  }
  return secret;
}

// Pre-computed dummy hash used to equalize bcrypt compare time when the user
// does not exist, preventing a user-enumeration oracle via response timing.
// Generated once per process start with the same cost as real hashes (12).
let DUMMY_HASH: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!DUMMY_HASH) {
    DUMMY_HASH = await hash('__dummy_password_for_timing__', 12);
  }
  return DUMMY_HASH;
}

export async function POST(req: NextRequest) {
  try {
    const jwtSecret = getJwtSecret();
    const body = await req.json();
    const { email, password, source } = body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        tenant: true,
      },
    });

    // Equalize timing: always run bcrypt.compare even if the user is missing
    // or has no password hash. Prevents timing-based user enumeration.
    const hashToCheck = user?.passwordHash || (await getDummyHash());
    const passwordMatches = await compare(password, hashToCheck);

    if (!user || !user.passwordHash || !passwordMatches) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Enforce account state gates that the browser login flow also enforces.
    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: { code: 'ACCOUNT_INACTIVE', message: 'Account is not active' } },
        { status: 403 }
      );
    }

    // MFA cannot be satisfied from the Word Add-in password form — users with
    // MFA enabled must sign in through the browser flow to complete the second
    // factor. Silently minting a 7-day JWT here would bypass MFA.
    if (user.mfaEnabled) {
      return NextResponse.json(
        {
          error: {
            code: 'MFA_REQUIRED',
            message: 'Multi-factor authentication is enabled. Please sign in through the browser to use the Word Add-in.',
          },
        },
        { status: 403 }
      );
    }

    // Get primary tenant
    const primaryTenant = user.tenant;
    if (!primaryTenant) {
      return NextResponse.json(
        { error: { code: 'NO_TENANT', message: 'User has no associated tenant' } },
        { status: 403 }
      );
    }

    // Generate JWT token for add-in
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        tenantId: primaryTenant.id,
        source: source || 'word-addin',
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Log authentication
    await prisma.auditLog.create({
      data: {
        tenantId: primaryTenant.id,
        userId: user.id,
        action: 'auth.addin_login',
        resource: 'word-addin',
        details: {
          source: source || 'word-addin',
          ip: req.headers.get('x-forwarded-for') || 'unknown',
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        tenantId: primaryTenant.id,
        user: {
          id: user.id,
          name: user.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user.email,
          email: user.email,
        },
      },
    });
  } catch (error) {
    logger.error('Word Add-in login error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Authentication failed' } },
      { status: 500 }
    );
  }
}
