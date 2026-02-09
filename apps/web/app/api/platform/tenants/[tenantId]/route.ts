/**
 * Platform Admin - Single Tenant Management API
 * 
 * Allows platform owners to view, update, or switch context to a specific tenant
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { monitoringService } from 'data-orchestration/services';

// GET - Get tenant details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const session = await auth();
    const { tenantId } = await params;
    
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
}

// PATCH - Update tenant
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const session = await auth();
    const { tenantId } = await params;
    
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
}

// DELETE - Delete/deactivate tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const session = await auth();
    const { tenantId } = await params;
    
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
}
