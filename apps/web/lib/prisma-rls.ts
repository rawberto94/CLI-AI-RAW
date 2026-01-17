/**
 * Prisma RLS Integration
 * 
 * Automatically sets the tenant context before each query
 * to enable PostgreSQL Row-Level Security policies.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Extended Prisma Client with RLS support
 */
export function createRLSPrismaClient(): PrismaClient {
  const prisma = new PrismaClient();

  return prisma.$extends({
    query: {
      $allOperations: async ({ args, query, model, operation }) => {
        // Get tenant ID from async local storage or context
        const tenantId = getCurrentTenantId();
        
        if (tenantId) {
          // Set the tenant context for RLS
          await prisma.$executeRaw`SELECT set_current_tenant(${tenantId})`;
        }
        
        return query(args);
      },
    },
  }) as PrismaClient;
}

/**
 * Tenant context storage using AsyncLocalStorage
 */
import { AsyncLocalStorage } from 'async_hooks';

interface TenantContext {
  tenantId: string;
  userId?: string;
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Run a function with tenant context
 */
export function runWithTenant<T>(
  tenantId: string,
  userId: string | undefined,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return tenantStorage.run({ tenantId, userId }, fn);
}

/**
 * Get current tenant ID from context
 */
export function getCurrentTenantId(): string | undefined {
  return tenantStorage.getStore()?.tenantId;
}

/**
 * Get current user ID from context
 */
export function getCurrentUserId(): string | undefined {
  return tenantStorage.getStore()?.userId;
}

/**
 * Prisma middleware for RLS (alternative to $extends)
 */
export function rlsMiddleware(tenantId: string) {
  return async (params: any, next: (params: any) => Promise<any>) => {
    // Before query: set tenant context
    // Note: This requires a raw query which may not work with all Prisma operations
    // The $extends approach above is preferred
    
    return next(params);
  };
}

/**
 * Helper to wrap API handlers with tenant context
 */
export function withTenantContext<T>(
  handler: (req: Request, context: any) => Promise<T>
) {
  return async (req: Request, context: any): Promise<T> => {
    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');
    
    if (!tenantId) {
      throw new Error('Missing tenant context');
    }
    
    return runWithTenant(tenantId, userId ?? undefined, () => handler(req, context));
  };
}

/**
 * Direct SQL approach for setting RLS context
 * Use this in API routes before any Prisma queries
 */
export async function setRLSContext(
  prisma: PrismaClient,
  tenantId: string,
  userId?: string
): Promise<void> {
  await prisma.$executeRaw`SELECT set_current_tenant(${tenantId})`;
  if (userId) {
    await prisma.$executeRaw`SELECT set_current_user_id(${userId})`;
  }
}

/**
 * Verify RLS is working by checking the current tenant
 */
export async function verifyRLSContext(prisma: PrismaClient): Promise<string | null> {
  const result = await prisma.$queryRaw<[{ current_tenant_id: string }]>`
    SELECT current_tenant_id() as current_tenant_id
  `;
  return result[0]?.current_tenant_id ?? null;
}
