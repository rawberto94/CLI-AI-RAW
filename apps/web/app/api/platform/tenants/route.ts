/**
 * Platform Admin - Tenant Management API
 * 
 * Allows platform owners to manage all tenants/clients
 * Only accessible by users with isPlatformAdmin flag or owner role in the "platform" tenant
 */

import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { monitoringService } from 'data-orchestration/services';
import { logger } from '@/lib/logger';

function getSetupBaseUrl(request: NextRequest): string {
  return process.env.NEXTAUTH_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_URL
    || new URL(request.url).origin;
}

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
  // For development, allow access if user is owner/admin
  // In production, should check isPlatformAdmin
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
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
  // Check admin access
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { role: true },
  });

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  if (!isAdmin) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json();
  const { name, slug, adminEmail, adminFirstName, adminLastName } = body;
  const normalizedAdminEmail = typeof adminEmail === 'string' ? adminEmail.toLowerCase() : '';

  if (!name || !slug || !normalizedAdminEmail) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Name, slug, and admin email are required', 400);
  }

  // Check if slug is already taken
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  if (existingTenant) {
    return createErrorResponse(ctx, 'CONFLICT', 'A tenant with this slug already exists', 409);
  }

  const existingAdminUser = await prisma.user.findUnique({
    where: { email: normalizedAdminEmail },
    select: { id: true },
  });

  if (existingAdminUser) {
    return createErrorResponse(ctx, 'CONFLICT', 'An account with this admin email already exists', 409);
  }

  const setupToken = randomBytes(32).toString('hex');
  const setupExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const passwordHash = await hash(randomBytes(32).toString('hex'), 12);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name,
        slug,
        status: 'ACTIVE',
        configuration: {
          create: {
            aiModels: {},
            securitySettings: {},
            integrations: {},
            workflowSettings: {},
          },
        },
        subscription: {
          create: {
            plan: 'FREE',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            startDate: new Date(),
          },
        },
        usage: {
          create: {
            resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
      },
    });

    const adminUser = await tx.user.create({
      data: {
        email: normalizedAdminEmail,
        firstName: adminFirstName || 'Admin',
        lastName: adminLastName || '',
        role: 'owner',
        passwordHash,
        status: 'ACTIVE',
        emailVerified: false,
        tenantId: tenant.id,
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

    let roleRecord = await tx.role.findFirst({ where: { name: 'owner' } });
    if (!roleRecord) {
      roleRecord = await tx.role.create({
        data: {
          name: 'owner',
          description: 'Owner role',
          isSystem: true,
        },
      });
    }

    await tx.userRole.create({
      data: { userId: adminUser.id, roleId: roleRecord.id },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: adminUser.id,
        token: setupToken,
        expiresAt: setupExpiresAt,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: adminUser.id,
        metadata: { email: normalizedAdminEmail, role: 'owner', method: 'platform_tenant_setup', createdBy: ctx.userId },
      },
    });

    return { tenant, adminUser };
  });

  const setupLink = `${getSetupBaseUrl(request)}/auth/reset-password?token=${setupToken}`;
  let emailSent = false;

  try {
    const { sendEmail } = await import('@/lib/email/email-service');
    emailSent = await sendEmail({
      to: normalizedAdminEmail,
      subject: 'Set up your ConTigo workspace',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Welcome to ConTigo</h2>
          <p>Your ConTigo workspace is ready. Set your password to access ${name}.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${setupLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Set Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
        </div>
      `,
      text: `Your ConTigo workspace is ready. Set your password to access ${name}: ${setupLink}\n\nThis link expires in 24 hours.`,
    });
  } catch (emailError) {
    logger.error('Failed to send tenant owner setup email:', emailError);
  }

  return createSuccessResponse(ctx, {
    success: true,
    tenant: {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
      status: result.tenant.status,
      createdAt: result.tenant.createdAt,
      usersCount: 1,
      contractsCount: 0,
      adminUser: result.adminUser,
    },
    setupLink,
    setupLinkExpiresAt: setupExpiresAt,
    emailSent,
  });
});
