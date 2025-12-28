/**
 * Team Invitations Admin API
 * Create and list team invitations
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const invitations = await prisma.teamInvitation.findMany({
      where: { tenantId: session.user.tenantId },
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Get invitations error:", error);
    return NextResponse.json(
      { error: "Failed to get invitations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
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

    const body = await request.json();
    const { email, role = "member" } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if email already exists as a user in this tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        tenantId: session.user.tenantId,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email is already a team member" },
        { status: 409 }
      );
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        email,
        tenantId: session.user.tenantId,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "There's already a pending invitation for this email" },
        { status: 409 }
      );
    }

    // Generate secure token
    const token = randomBytes(32).toString("hex");
    
    // Set expiration to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.teamInvitation.create({
      data: {
        tenantId: session.user.tenantId,
        email,
        role,
        token,
        invitedBy: session.user.id,
        expiresAt,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "INVITATION_SENT",
        entityType: "INVITATION",
        entityId: invitation.id,
        metadata: { email, role },
      },
    });

    // Send invitation email
    const { sendEmail } = await import('@/lib/email/email-service');
    const { emailTemplates } = await import('@/lib/email/templates');
    
    const inviteLink = `${process.env.NEXTAUTH_URL || "http://localhost:3005"}/auth/signup?invite=${token}`;
    
    const template = emailTemplates.teamInvitation({
      invitedBy: 'Admin',
      tenantName: tenant.name,
      inviteUrl: inviteLink,
      expiresIn: '7 days',
    });
    
    await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
    });

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      inviteLink,
    });
  } catch (error) {
    console.error("Create invitation error:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
