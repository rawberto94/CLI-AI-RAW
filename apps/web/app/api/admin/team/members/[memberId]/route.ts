/**
 * Individual Team Member Admin API
 * Update and delete team members
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await auth();
    const { memberId } = await params;
    
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

    // Get target member
    const member = await prisma.user.findFirst({
      where: { 
        id: memberId,
        tenantId: session.user.tenantId,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot modify owner unless you are owner
    if (member.role === "owner" && currentUser.role !== "owner") {
      return NextResponse.json(
        { error: "Cannot modify organization owner" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role, status } = body;

    // Only owner can assign owner role
    if (role === "owner" && currentUser.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can assign owner role" },
        { status: 403 }
      );
    }

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: {
        ...(role && { role }),
        ...(status && { status }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "MEMBER_UPDATED",
        entityType: "USER",
        entityId: memberId,
        metadata: { role, status },
      },
    });

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    console.error("Update member error:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const session = await auth();
    const { memberId } = await params;
    
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

    // Get target member
    const member = await prisma.user.findFirst({
      where: { 
        id: memberId,
        tenantId: session.user.tenantId,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot delete owner
    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Cannot delete organization owner" },
        { status: 403 }
      );
    }

    // Cannot delete yourself
    if (member.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: memberId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "MEMBER_REMOVED",
        entityType: "USER",
        entityId: memberId,
        metadata: { email: member.email },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete member error:", error);
    return NextResponse.json(
      { error: "Failed to delete member" },
      { status: 500 }
    );
  }
}
