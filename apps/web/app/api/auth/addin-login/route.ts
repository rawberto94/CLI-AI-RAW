/**
 * Word Add-in Login API
 * Provides authentication for the Word Add-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'contigo-word-addin-secret';

export async function POST(req: NextRequest) {
  try {
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
        tenants: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Get primary tenant
    const primaryTenant = user.tenants[0]?.tenant;
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
      JWT_SECRET,
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
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (error) {
    console.error('Word Add-in login error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Authentication failed' } },
      { status: 500 }
    );
  }
}
