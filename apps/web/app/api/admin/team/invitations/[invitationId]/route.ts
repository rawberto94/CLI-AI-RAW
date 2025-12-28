/**
 * Individual Invitation Admin API
 * Revoke invitations
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const session = await auth();
    const { invitationId } = await params;
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin or owner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !["owner", "admin"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get invitation
    const invitation = await prisma.teamInvitation.findFirst({
      where: { 
        id: invitationId,
        tenantId: session.user.tenantId,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Can only revoke pending invitations" },
        { status: 400 }
      );
    }

    await prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "INVITATION_REVOKED",
        entityType: "INVITATION",
        entityId: invitationId,
        metadata: { email: invitation.email },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke invitation error:", error);
    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const session = await auth();
    const { invitationId } = await params;
    const body = await request.json();
    const { action } = body;
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin or owner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !["owner", "admin"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get invitation
    const invitation = await prisma.teamInvitation.findFirst({
      where: { 
        id: invitationId,
        tenantId: session.user.tenantId,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (action === "resend") {
      // Update expiration date
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await prisma.teamInvitation.update({
        where: { id: invitationId },
        data: { 
          expiresAt: newExpiresAt,
          status: "PENDING",
        },
      });

      // Resend invitation email
      const { sendEmail } = await import('@/lib/email/email-service');
      const { emailTemplates } = await import('@/lib/email/templates');
      
      const template = emailTemplates.teamInvitation({
        invitedBy: 'Admin',
        tenantName: tenant.name,
        inviteUrl: `${process.env.NEXT_PUBLIC_URL}/accept-invitation?token=${invitation.token}`,
        expiresIn: '7 days',
      });
      
      await sendEmail({
        to: invitation.email,
        subject: template.subject,
        html: template.html,
      });

      return NextResponse.json({ 
        success: true,
        message: "Invitation resent",
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Invitation action error:", error);
    return NextResponse.json(
      { error: "Failed to process invitation action" },
      { status: 500 }
    );
  }
}
