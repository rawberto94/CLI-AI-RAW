/**
 * Tenant Admin API
 * Get and update tenant information
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

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      include: {
        subscription: {
          select: {
            plan: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        usage: {
          select: {
            contractsProcessed: true,
            storageUsed: true,
            apiCallsCount: true,
            aiTokensUsed: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    // Get contract count excluding DELETED
    const contractsCount = await prisma.contract.count({
      where: {
        tenantId: session.user.tenantId,
        status: { not: 'DELETED' },
      },
    });

    return NextResponse.json({ 
      tenant: {
        ...tenant,
        _count: {
          ...tenant._count,
          contracts: contractsCount,
        },
      },
    });
  } catch (error) {
    console.error("Get tenant error:", error);
    return NextResponse.json(
      { error: "Failed to get tenant information" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin or owner
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !["owner", "admin"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    // Check if name is already taken by another tenant
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        name,
        NOT: { id: session.user.tenantId },
      },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: "Organization name is already taken" },
        { status: 409 }
      );
    }

    const tenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: { name },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "TENANT_UPDATED",
        entityType: "TENANT",
        entityId: tenant.id,
        metadata: { name },
      },
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("Update tenant error:", error);
    return NextResponse.json(
      { error: "Failed to update tenant" },
      { status: 500 }
    );
  }
}
