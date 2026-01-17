/**
 * Verify Invite Token API
 * Validates invitation tokens and returns tenant info
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        token,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({
        valid: false,
        error: "Invalid or expired invitation",
      });
    }

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      tenantId: invitation.tenantId,
      tenantName: invitation.tenant.name,
      role: invitation.role,
    });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Failed to verify invitation" },
      { status: 500 }
    );
  }
}
