/**
 * One-time admin setup endpoint
 * Creates an admin user for the platform
 * Should be removed after use
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

// SECURITY: This endpoint can create admin users and lists existing users.
// The "setup key" is derived from NEXTAUTH_SECRET—if that leaks, attackers
// escalate to admin. Gate behind NODE_ENV in production unless explicitly
// opted in via ENABLE_DEBUG_ENDPOINTS.
const isProductionLocked =
  process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINTS !== 'true';

export async function POST(request: Request) {
  if (isProductionLocked) {
    return new NextResponse(null, { status: 404 });
  }
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

// GET to list current users, or create admin with ?action=create&key=<first16chars>
export async function GET(request: Request) {
  if (isProductionLocked) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const key = url.searchParams.get("key");

    if (action === "create") {
      if (key !== process.env.NEXTAUTH_SECRET?.substring(0, 16)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const adminEmail = "admin@mycontigo.app";
      const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (existing) {
        if (existing.status !== "ACTIVE") {
          await prisma.user.update({ where: { email: adminEmail }, data: { status: "ACTIVE" } });
        }
        return NextResponse.json({ message: "Admin already exists", email: adminEmail, status: existing.status });
      }

      const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
      if (!tenant) {
        return NextResponse.json({ error: "No tenants found" }, { status: 400 });
      }

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
      });
    }

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
