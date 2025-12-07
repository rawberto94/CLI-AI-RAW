/**
 * Tenant Isolation Utilities
 * Provides consistent tenant scoping for database queries
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface TenantScope {
  tenantId: string;
  userId: string;
  userRole: string;
  isAdmin: boolean;
  isOwner: boolean;
}

/**
 * Get tenant scope from request
 * Returns null if not authenticated or no tenant access
 */
export async function getTenantScope(request: NextRequest): Promise<TenantScope | null> {
  const session = await auth();
  
  if (!session?.user?.id || !session?.user?.tenantId) {
    return null;
  }

  // Get user role from database for accuracy
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, tenantId: true },
  });

  if (!user || user.tenantId !== session.user.tenantId) {
    return null;
  }

  return {
    tenantId: session.user.tenantId,
    userId: session.user.id,
    userRole: user.role,
    isAdmin: user.role === "admin" || user.role === "owner",
    isOwner: user.role === "owner",
  };
}

/**
 * Require tenant scope - returns error response if not authenticated
 */
export async function requireTenantScope(
  request: NextRequest
): Promise<TenantScope | NextResponse> {
  const scope = await getTenantScope(request);
  
  if (!scope) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }

  return scope;
}

/**
 * Require admin scope - returns error response if not admin
 */
export async function requireAdminScope(
  request: NextRequest
): Promise<TenantScope | NextResponse> {
  const scope = await getTenantScope(request);
  
  if (!scope) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }

  if (!scope.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 }
    );
  }

  return scope;
}

/**
 * Require owner scope - returns error response if not owner
 */
export async function requireOwnerScope(
  request: NextRequest
): Promise<TenantScope | NextResponse> {
  const scope = await getTenantScope(request);
  
  if (!scope) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }

  if (!scope.isOwner) {
    return NextResponse.json(
      { error: "Forbidden", message: "Owner access required" },
      { status: 403 }
    );
  }

  return scope;
}

/**
 * Check if scope is an error response
 */
export function isScopeError(scope: TenantScope | NextResponse): scope is NextResponse {
  return scope instanceof NextResponse;
}

/**
 * Create a tenant-scoped where clause for Prisma queries
 */
export function tenantWhere(tenantId: string, additionalWhere: Record<string, any> = {}) {
  return {
    tenantId,
    ...additionalWhere,
  };
}

/**
 * Validate that a resource belongs to the tenant
 */
export async function validateResourceAccess(
  scope: TenantScope,
  resourceType: "contract" | "template" | "rateCard",
  resourceId: string
): Promise<boolean> {
  const models: Record<string, any> = {
    contract: prisma.contract,
    template: prisma.contractTemplate,
    rateCard: prisma.rateCard,
  };

  const model = models[resourceType];
  if (!model) return false;

  const resource = await model.findFirst({
    where: {
      id: resourceId,
      tenantId: scope.tenantId,
    },
    select: { id: true },
  });

  return !!resource;
}

/**
 * Audit log helper with tenant isolation
 */
export async function createAuditLog(
  scope: TenantScope,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, any>
) {
  return prisma.auditLog.create({
    data: {
      tenantId: scope.tenantId,
      userId: scope.userId,
      action,
      entityType,
      entityId,
      metadata: metadata || {},
    },
  });
}

export default {
  getTenantScope,
  requireTenantScope,
  requireAdminScope,
  requireOwnerScope,
  isScopeError,
  tenantWhere,
  validateResourceAccess,
  createAuditLog,
};
