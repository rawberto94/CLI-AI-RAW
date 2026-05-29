/**
 * Team Members Admin API
 * List and manage team members
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringService } from 'data-orchestration/services';
import { logger } from '@/lib/logger';

function canManageTeam(userRole: string | undefined): boolean {
  return userRole === 'owner' || userRole === 'admin' || userRole === 'superadmin';
}

const managedMemberSchema = z.object({
  email: z.string().email('Valid email is required').max(255).transform(value => value.toLowerCase()),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100).optional().default(''),
  role: z.enum(['admin', 'manager', 'member', 'viewer']).default('member'),
  sendSetupEmail: z.boolean().optional().default(true),
});

function getSetupBaseUrl(request: NextRequest): string {
  return process.env.NEXTAUTH_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_URL
    || new URL(request.url).origin;
}

export const GET = withAuthApiHandler(async (_request, ctx) => {
  if (!canManageTeam(ctx.userRole)) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        retryable: false,
      },
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    }, {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': ctx.requestId,
        'X-Response-Time': `${Date.now() - ctx.startTime}ms`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const members = await prisma.user.findMany({
    where: { tenantId: ctx.tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: [
      { role: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return createSuccessResponse(ctx, { members });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!canManageTeam(ctx.userRole)) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403, { retryable: false });
  }

  const body = await request.json();
  const parsed = managedMemberSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      ctx,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Invalid request body',
      400,
    );
  }

  const { email, firstName, lastName, role, sendSetupEmail } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, tenantId: true },
  });

  if (existingUser) {
    const message = existingUser.tenantId === ctx.tenantId
      ? 'User with this email is already a team member'
      : 'An account with this email already exists in another tenant';
    return createErrorResponse(ctx, 'CONFLICT', message, 409);
  }

  const existingInvitation = await prisma.teamInvitation.findFirst({
    where: {
      email,
      tenantId: ctx.tenantId,
      status: 'PENDING',
    },
    select: { id: true },
  });

  if (existingInvitation) {
    return createErrorResponse(ctx, 'CONFLICT', 'There is already a pending invitation for this email', 409);
  }

  const setupToken = randomBytes(32).toString('hex');
  const setupExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const randomPassword = randomBytes(32).toString('hex');
  const passwordHash = await hash(randomPassword, 12);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        firstName,
        lastName: lastName || null,
        passwordHash,
        tenantId: ctx.tenantId,
        role,
        status: 'ACTIVE',
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    let roleRecord = await tx.role.findFirst({ where: { name: role } });
    if (!roleRecord) {
      roleRecord = await tx.role.create({
        data: {
          name: role,
          description: `${role.charAt(0).toUpperCase() + role.slice(1)} role`,
          isSystem: true,
        },
      });
    }

    await tx.userRole.create({
      data: { userId: createdUser.id, roleId: roleRecord.id },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: createdUser.id,
        token: setupToken,
        expiresAt: setupExpiresAt,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: createdUser.id,
        metadata: { email, role, method: 'admin_setup' },
      },
    });

    return createdUser;
  });

  const setupLink = `${getSetupBaseUrl(request)}/auth/reset-password?token=${setupToken}`;
  let emailSent = false;

  if (sendSetupEmail) {
    try {
      const { sendEmail } = await import('@/lib/email/email-service');
      emailSent = await sendEmail({
        to: email,
        subject: 'Set up your ConTigo account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Welcome to ConTigo</h2>
            <p>An administrator created your ConTigo account. Set your password to finish setup.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${setupLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Set Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
          </div>
        `,
        text: `Welcome to ConTigo. Set your password to finish setup: ${setupLink}\n\nThis link expires in 24 hours.`,
      });
    } catch (emailError) {
      logger.error('Failed to send account setup email:', emailError);
    }
  }

  return createSuccessResponse(ctx, {
    member: user,
    setupLink,
    setupLinkExpiresAt: setupExpiresAt,
    emailSent,
  }, { status: 201 });
});
