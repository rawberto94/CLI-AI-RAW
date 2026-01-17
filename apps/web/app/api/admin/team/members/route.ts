/**
 * Team Members Admin API
 * List and manage team members
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const members = await prisma.user.findMany({
      where: { tenantId: session.user.tenantId },
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
        { role: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({ members });
  } catch {
    return NextResponse.json(
      { error: "Failed to get team members" },
      { status: 500 }
    );
  }
}
