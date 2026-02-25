/**
 * Word Add-in Login API
 * Provides authentication for the Word Add-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('CRITICAL: JWT_SECRET or NEXTAUTH_SECRET must be configured for Word Add-in authentication');
  }
  return secret;
}

export async function POST(req: NextRequest) {
  try {
    const jwtSecret = getJwtSecret();
    const body = await req.json();
    const { email, password, source } = body;

    if (!email || !password) {
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

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 }
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
