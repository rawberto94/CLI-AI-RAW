/**
 * Platform Admin - Single Tenant Management API
 * 
 * Allows platform owners to view, update, or switch context to a specific tenant
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { monitoringService } from 'data-orchestration/services';

/**
 * Verify the caller is an admin and has access to the target tenant.
 * - Regular admins can manage their own tenant.
 * - Cross-tenant access requires a designated platform admin (PLATFORM_ADMIN_TENANT_ID).
 */
async function verifyPlatformAdminAccess(
  ctx: ReturnType<typeof getApiContext>,
  userId: string,
  targetTenantId: string,
): Promise<Response | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tenantId: true },
  });

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  if (!isAdmin) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  // Cross-tenant access requires platform admin privileges
  const PLATFORM_TENANT_ID = process.env.PLATFORM_ADMIN_TENANT_ID;
  const isCrossTenant = user?.tenantId !== targetTenantId;
  if (isCrossTenant && (!PLATFORM_TENANT_ID || user?.tenantId !== PLATFORM_TENANT_ID)) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Cross-tenant access requires platform admin privileges', 403);
  }

  return null; // Access granted
}

// GET - Get tenant details
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const { tenantId } = await (ctx as any).params as { tenantId: string };

    const accessDenied = await verifyPlatformAdminAccess(ctx, ctx.userId, tenantId);
    if (accessDenied) return accessDenied;

    // Get tenant with full details
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
        subscription: true,
        usage: true,
        users: {
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
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
    }

    // Get contract count excluding DELETED
    const contractsCount = await prisma.contract.count({
      where: {
        tenantId,
        isDeleted: false,
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        createdAt: tenant.createdAt,
        usersCount: tenant._count.users,
        contractsCount: contractsCount,
        subscription: tenant.subscription,
        usage: tenant.usage,
        users: tenant.users,
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
})

// PATCH - Update tenant
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { tenantId } = await (ctx as any).params as { tenantId: string };

    const accessDenied = await verifyPlatformAdminAccess(ctx, ctx.userId, tenantId);
    if (accessDenied) return accessDenied;

    const body = await request.json();
    const { name, status } = body;

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name && { name }),
        ...(status && { status }),
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      tenant,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
})

// DELETE - Delete/deactivate tenant
export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const { tenantId } = await (ctx as any).params as { tenantId: string };

    const accessDenied = await verifyPlatformAdminAccess(ctx, ctx.userId, tenantId);
    if (accessDenied) return accessDenied;

    // Soft delete - set status to SUSPENDED
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'SUSPENDED' },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Tenant suspended successfully',
      tenant,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
})
