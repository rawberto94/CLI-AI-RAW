/**
 * One-time admin setup endpoint
 * Creates an admin user for the platform
 * Should be removed after use
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const setupKey = body.setupKey;

    // Simple protection - require a setup key
    if (setupKey !== process.env.NEXTAUTH_SECRET?.substring(0, 16)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminEmail = "admin@mycontigo.app";

    // Check if admin already exists
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existing) {
      // Update to ACTIVE if not already
      if (existing.status !== "ACTIVE") {
        await prisma.user.update({ where: { email: adminEmail }, data: { status: "ACTIVE" } });
      }
      return NextResponse.json({ message: "Admin already exists", email: adminEmail, status: existing.status });
    }

    // Find first tenant
    const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
    if (!tenant) {
      return NextResponse.json({ error: "No tenants found" }, { status: 400 });
    }

    // Also list existing users for debugging
    const users = await prisma.user.findMany({
      select: { email: true, status: true, role: true, tenantId: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const passwordHash = await hash("ContigoAdmin2026!", 12);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: "Admin",
        lastName: "Contigo",
        passwordHash,
        tenantId: tenant.id,
        role: "owner",
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    return NextResponse.json({
      message: "Admin created successfully",
      admin: { email: admin.email, tenantId: admin.tenantId, role: admin.role },
      existingUsers: users,
    });
  } catch (error) {
    console.error("[Admin Setup] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET to list current users (for debugging)
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, status: true, role: true, tenantId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
      take: 10,
    });

    return NextResponse.json({ users, tenants });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
