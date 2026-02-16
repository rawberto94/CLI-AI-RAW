/**
 * Individual Invitation Admin API
 * Revoke invitations
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { invitationId } = await params;

    // Get invitation
    const invitation = await prisma.teamInvitation.findFirst({
      where: { 
        id: invitationId,
        tenantId: ctx.tenantId,
      },
    });

    if (!invitation) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Invitation not found', 404);
    }

    if (invitation.status !== 'PENDING') {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Can only revoke pending invitations', 400);
    }

    await prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'INVITATION_REVOKED',
        entityType: 'INVITATION',
        entityId: invitationId,
        metadata: { email: invitation.email },
      },
    });

    return createSuccessResponse(ctx, {});
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { invitationId } = await params;
    const body = await request.json();
    const { action } = body;

    // Get invitation
    const invitation = await prisma.teamInvitation.findFirst({
      where: { 
        id: invitationId,
        tenantId: ctx.tenantId,
      },
    });

    if (!invitation) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Invitation not found', 404);
    }

    if (action === 'resend') {
      // Update expiration date
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { 
          expiresAt: newExpiresAt,
          status: 'PENDING',
        },
      });

      // Resend invitation email
      const { sendEmail } = await import('@/lib/email/email-service');
      const { emailTemplates } = await import('@/lib/email/templates');

      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { name: true },
      });
      
      const template = emailTemplates.teamInvitation({
        invitedBy: 'Admin',
        tenantName: tenant?.name || 'Contigo',
        inviteUrl: `${process.env.NEXT_PUBLIC_URL}/accept-invitation?token=${invitation.token}`,
        expiresIn: '7 days',
      });
      
      await sendEmail({
        to: invitation.email,
        subject: template.subject,
        html: template.html,
      });

      return createSuccessResponse(ctx, { message: 'Invitation resent' });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action', 400);
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
