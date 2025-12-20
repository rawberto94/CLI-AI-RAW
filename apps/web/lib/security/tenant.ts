/**
 * Tenant Security Module
 * Provides secure tenant extraction and validation for multi-tenant API routes
 * 
 * IMPORTANT: Always use getApiTenantId() instead of extracting tenantId from
 * query parameters or request body to prevent tenant bypass attacks.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Custom error for tenant-related issues
 */
export class TenantError extends Error {
  constructor(
    message: string,
    public code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INVALID' | 'FORBIDDEN'
  ) {
    super(message);
    this.name = 'TenantError';
  }
}

/**
 * Securely extract tenant ID from authenticated session
 * This is the primary method for tenant extraction in API routes
 * 
 * @param request - The incoming Next.js request
 * @returns The authenticated user's tenant ID, or null if not authenticated
 * 
 * @example
 * ```ts
 * const tenantId = await getApiTenantId(request);
 * if (!tenantId) {
 *   return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
 * }
 * ```
 */
export async function getApiTenantId(request: NextRequest): Promise<string | null> {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.tenantId) {
      return null;
    }
    
    return session.user.tenantId;
  } catch (error) {
    console.error('Error extracting tenant ID from session:', error);
    return null;
  }
}

/**
 * Get tenant ID with validation that the tenant exists and is active
 * 
 * @param request - The incoming Next.js request
 * @returns The validated tenant ID
 * @throws TenantError if tenant is not found or inactive
 */
export async function getValidatedTenantId(request: NextRequest): Promise<string> {
  const tenantId = await getApiTenantId(request);
  
  if (!tenantId) {
    throw new TenantError('Authentication required', 'UNAUTHORIZED');
  }
  
  // Verify tenant exists and is active
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, status: true },
  });
  
  if (!tenant) {
    throw new TenantError('Tenant not found', 'NOT_FOUND');
  }
  
  if (tenant.status !== 'ACTIVE') {
    throw new TenantError('Tenant is not active', 'FORBIDDEN');
  }
  
  return tenantId;
}

/**
 * Check if a user has access to a specific tenant
 * Useful for cross-tenant operations (admin, support)
 * 
 * @param userId - The user's ID
 * @param targetTenantId - The tenant ID to check access for
 * @returns True if user has access to the tenant
 */
export async function hasAccessToTenant(
  userId: string,
  targetTenantId: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        tenantId: true, 
        role: true,
        tenant: {
          select: { status: true }
        }
      },
    });
    
    if (!user) {
      return false;
    }
    
    // User belongs to the target tenant
    if (user.tenantId === targetTenantId) {
      return user.tenant?.status === 'ACTIVE';
    }
    
    // Check for super admin role (can access any tenant)
    if (user.role === 'super_admin' || user.role === 'SUPER_ADMIN') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking tenant access:', error);
    return false;
  }
}

/**
 * Create a tenant-scoped Prisma where clause
 * Helper to ensure all queries are properly scoped to tenant
 * 
 * @param tenantId - The tenant ID to scope to
 * @param additionalWhere - Additional where conditions
 * @returns Combined where clause with tenant scoping
 * 
 * @example
 * ```ts
 * const contracts = await prisma.contract.findMany({
 *   where: tenantWhere(tenantId, { status: 'ACTIVE' }),
 * });
 * ```
 */
export function tenantWhere<T extends Record<string, unknown>>(
  tenantId: string,
  additionalWhere?: T
): T & { tenantId: string } {
  return {
    tenantId,
    ...(additionalWhere || {}),
  } as T & { tenantId: string };
}

/**
 * Validate that a resource belongs to the specified tenant
 * Prevents accessing resources from other tenants
 * 
 * @param resourceTenantId - The tenant ID from the resource
 * @param expectedTenantId - The expected/session tenant ID
 * @throws TenantError if tenant IDs don't match
 */
export function assertTenantMatch(
  resourceTenantId: string | null | undefined,
  expectedTenantId: string
): void {
  if (resourceTenantId !== expectedTenantId) {
    throw new TenantError(
      'Resource does not belong to your tenant',
      'FORBIDDEN'
    );
  }
}

/**
 * Get tenant context from request headers
 * Useful for server-to-server calls with tenant context
 * 
 * @param request - The incoming request
 * @returns Tenant ID from X-Tenant-ID header
 */
export function getTenantFromHeaders(request: NextRequest): string | null {
  return request.headers.get('X-Tenant-ID');
}

/**
 * Higher-order function to create tenant-scoped API handlers
 * Automatically extracts and validates tenant ID
 * 
 * @param handler - The API handler function
 * @returns Wrapped handler with tenant context
 * 
 * @example
 * ```ts
 * export const GET = withTenantContext(async (request, tenantId) => {
 *   const data = await prisma.contract.findMany({
 *     where: { tenantId },
 *   });
 *   return NextResponse.json(data);
 * });
 * ```
 */
export function withTenantContext<T>(
  handler: (request: NextRequest, tenantId: string) => Promise<T>
): (request: NextRequest) => Promise<T | Response> {
  return async (request: NextRequest) => {
    try {
      const tenantId = await getApiTenantId(request);
      
      if (!tenantId) {
        const { NextResponse } = await import('next/server');
        return NextResponse.json(
          { error: 'Tenant ID required' },
          { status: 400 }
        );
      }
      
      return await handler(request, tenantId);
    } catch (error) {
      if (error instanceof TenantError) {
        const { NextResponse } = await import('next/server');
        const statusMap = {
          UNAUTHORIZED: 401,
          NOT_FOUND: 404,
          INVALID: 400,
          FORBIDDEN: 403,
        };
        return NextResponse.json(
          { error: error.message },
          { status: statusMap[error.code] }
        );
      }
      throw error;
    }
  };
}

/**
 * Audit log entry for tenant operations
 * Records tenant-related security events
 */
export async function logTenantOperation(
  tenantId: string,
  userId: string,
  operation: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: operation,
        resource: 'tenant',
        resourceId: tenantId,
        metadata: details ? JSON.stringify(details) : undefined,
        ipAddress: null,
        userAgent: null,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Don't fail the operation if audit logging fails
    console.error('Failed to log tenant operation:', error);
  }
}

/**
 * Get all tenants a user has access to
 * Useful for users with cross-tenant permissions
 */
export async function getUserAccessibleTenants(
  userId: string
): Promise<Array<{ id: string; name: string; role: string }>> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tenantId: true,
        role: true,
        tenant: {
          select: { id: true, name: true, status: true },
        },
      },
    });
    
    if (!user || user.tenant?.status !== 'ACTIVE') {
      return [];
    }
    
    // For now, users only have access to their primary tenant
    // This can be extended for multi-tenant access
    return [{
      id: user.tenant.id,
      name: user.tenant.name,
      role: user.role,
    }];
  } catch (error) {
    console.error('Error getting accessible tenants:', error);
    return [];
  }
}
