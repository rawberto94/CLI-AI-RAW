/**
 * Team Invitations Admin API
 * Create and list team invitations
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';
import { randomBytes } from 'crypto';

function canManageTeam(userRole: string | undefined): boolean {
  return userRole === 'owner' || userRole === 'admin' || userRole === 'superadmin';
}

export const GET = withAuthApiHandler(async (_request, ctx) => {
  if (!canManageTeam(ctx.userRole)) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403, { retryable: false });
  }

  const invitations = await prisma.teamInvitation.findMany({
    where: { tenantId: ctx.tenantId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      token: true,
      expiresAt: true,
      createdAt: true,
      acceptedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return createSuccessResponse(ctx, { invitations });
});

export const POST = withAuthApiHandler(async (request, ctx) => {
  if (!canManageTeam(ctx.userRole)) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403, { retryable: false });
  }

  const body = await request.json();
  const { email, role = 'member' } = body;

  if (!email) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Email is required', 400);
  }

  // Check if email already exists as a user in this tenant
  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      tenantId: ctx.tenantId,
    },
  });

  if (existingUser) {
    return createErrorResponse(ctx, 'CONFLICT', 'User with this email is already a team member', 409);
  }

  // Check if there's already a pending invitation
  const existingInvitation = await prisma.teamInvitation.findFirst({
    where: {
      email,
      tenantId: ctx.tenantId,
      status: 'PENDING',
    },
  });

  if (existingInvitation) {
    return createErrorResponse(ctx, 'CONFLICT', "There's already a pending invitation for this email", 409);
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await prisma.teamInvitation.create({
    data: {
      tenantId: ctx.tenantId,
      email,
      role,
      token,
      invitedBy: ctx.userId,
      expiresAt,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'INVITATION_SENT',
      entityType: 'INVITATION',
      entityId: invitation.id,
      metadata: { email, role },
    },
  });

  // Send invitation email
  const { sendEmail } = await import('@/lib/email/email-service');
  const { emailTemplates } = await import('@/lib/email/templates');

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const inviteLink = `${process.env.NEXTAUTH_URL}/auth/signup?invite=${token}`;

  const template = emailTemplates.teamInvitation({
    invitedBy: 'Admin',
    tenantName: tenant?.name || 'Contigo',
    inviteUrl: inviteLink,
    expiresIn: '7 days',
  });

  await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
  });

  return createSuccessResponse(ctx, {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
    inviteLink,
  });
});
