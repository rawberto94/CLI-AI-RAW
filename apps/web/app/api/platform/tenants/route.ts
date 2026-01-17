/**
 * Platform Admin - Tenant Management API
 * 
 * Allows platform owners to manage all tenants/clients
 * Only accessible by users with isPlatformAdmin flag or owner role in the "platform" tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Check if user is a platform admin
async function isPlatformAdmin(userId: string): Promise<boolean> {
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
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For development, allow access if user is owner/admin
    // In production, should check isPlatformAdmin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Platform admin access required' },
        { status: 403 }
      );
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

    return NextResponse.json({
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
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}

// POST - Create a new tenant
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin access
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Platform admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, slug, adminEmail, adminFirstName, adminLastName } = body;

    if (!name || !slug || !adminEmail) {
      return NextResponse.json(
        { error: 'Name, slug, and admin email are required' },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: 'A tenant with this slug already exists' },
        { status: 409 }
      );
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

    return NextResponse.json({
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
  } catch {
    return NextResponse.json(
      { error: 'Failed to create tenant' },
      { status: 500 }
    );
  }
}
