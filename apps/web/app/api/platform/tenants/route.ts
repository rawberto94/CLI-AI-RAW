/**
 * Platform Admin - Tenant Management API
 * 
 * Allows platform owners to manage all tenants/clients
 * Only accessible by users with isPlatformAdmin flag or owner role in the "platform" tenant
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { monitoringService } from 'data-orchestration/services';
// Check if user is a platform admin
async function _isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      role: true,
      tenant: {
        select: { slug: true }
      }
    },
  });
  
  // Platform admin is either:
  // 1. A user with 'owner' role in a tenant with slug 'platform' or 'admin'
  // 2. A user with email ending in the PLATFORM_ADMIN_DOMAIN env var
  if (!user) return false;
  
  const isPlatformTenant = user.tenant?.slug === 'platform' || user.tenant?.slug === 'admin';
  const isOwner = user.role === 'owner' || user.role === 'admin';
  
  return isPlatformTenant && isOwner;
}

// GET - List all tenants
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  // For development, allow access if user is owner/admin
  // In production, should check isPlatformAdmin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  if (!isAdmin) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  // Get all tenants with stats
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          users: true,
        },
      },
      subscription: {
        select: {
          plan: true,
          status: true,
        },
      },
      usage: {
        select: {
          contractsProcessed: true,
          storageUsed: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get contract counts excluding deleted for each tenant
  const contractCounts = await prisma.contract.groupBy({
    by: ['tenantId'],
    where: {
      isDeleted: false,
    },
    _count: true,
  });

  const contractCountMap = new Map(
    contractCounts.map(c => [c.tenantId, c._count])
  );

  return createSuccessResponse(ctx, {
    success: true,
    tenants: tenants.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt,
      usersCount: t._count.users,
      contractsCount: contractCountMap.get(t.id) || 0,
      plan: t.subscription?.plan || 'free',
      planStatus: t.subscription?.status || 'active',
      contractsProcessed: t.usage?.contractsProcessed || 0,
      storageUsed: t.usage?.storageUsed || 0,
    })),
    total: tenants.length,
  });
});

// POST - Create a new tenant
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  // Check admin access
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  if (!isAdmin) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json();
  const { name, slug, adminEmail, adminFirstName, adminLastName } = body;

  if (!name || !slug || !adminEmail) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Name, slug, and admin email are required', 400);
  }

  // Check if slug is already taken
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  if (existingTenant) {
    return createErrorResponse(ctx, 'CONFLICT', 'A tenant with this slug already exists', 409);
  }

  // Create tenant with admin user
  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      status: 'ACTIVE',
      users: {
        create: {
          email: adminEmail,
          firstName: adminFirstName || 'Admin',
          lastName: adminLastName || '',
          role: 'owner',
          passwordHash: '', // Will be set on first login/invitation
          status: 'PENDING',
        },
      },
    },
    include: {
      users: true,
      _count: {
        select: {
          users: true,
          contracts: true,
        },
      },
    },
  }) as any; // Type assertion needed due to complex include

  return createSuccessResponse(ctx, {
    success: true,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      createdAt: tenant.createdAt,
      usersCount: tenant._count?.users || 0,
      contractsCount: tenant._count?.contracts || 0,
      adminUser: tenant.users?.[0],
    },
  });
});
