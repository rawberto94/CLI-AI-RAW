/**
 * Server-Side Tenant Management Utilities
 * Production-ready multi-tenant isolation with session integration
 * 
 * NOTE: This file uses next/headers and can only be used in Server Components or API routes
 */

import { getServerSession } from "@/lib/auth";
import { headers } from "next/headers";

// ============================================
// Server-Side Tenant Context
// ============================================

export interface TenantContext {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  isAuthenticated: boolean;
}

/**
 * Get tenant context from authenticated session or headers (Server-side)
 * Falls back to 'demo' only in development mode
 */
export async function getTenantContext(): Promise<TenantContext> {
  // Try to get from authenticated session first
  try {
    const session = await getServerSession();
    
    if (session?.user) {
      return {
        tenantId: session.user.tenantId || getDefaultTenantId(),
        userId: session.user.id,
        userEmail: session.user.email || undefined,
        isAuthenticated: true,
      };
    }
  } catch (error) {
    // Session not available, continue with header-based lookup
    console.debug("Session not available, using header-based tenant lookup");
  }

  // Fall back to header-based tenant ID
  const headersList = await headers();
  const headerTenantId = headersList.get("x-tenant-id");
  
  if (headerTenantId) {
    return {
      tenantId: headerTenantId,
      isAuthenticated: false,
    };
  }

  // Return demo tenant only in development
  return {
    tenantId: getDefaultTenantId(),
    isAuthenticated: false,
  };
}

/**
 * Get tenant ID only - async server version
 */
export async function getServerTenantId(): Promise<string> {
  const context = await getTenantContext();
  return context.tenantId;
}

/**
 * Get default tenant ID based on environment
 */
function getDefaultTenantId(): string {
  if (process.env.NODE_ENV === "production" && process.env.REQUIRE_AUTH === "true") {
    // In strict production mode, require explicit tenant
    throw new Error("Tenant ID required. Please authenticate or provide x-tenant-id header.");
  }
  return "demo";
}

/**
 * Require authenticated tenant context
 * Throws if user is not authenticated in production
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const context = await getTenantContext();
  
  if (!context.isAuthenticated && process.env.NODE_ENV === "production" && process.env.REQUIRE_AUTH === "true") {
    throw new Error("Authentication required");
  }
  
  return context;
}

/**
 * Validate that the user has access to a specific tenant
 */
export async function validateTenantAccess(requestedTenantId: string): Promise<boolean> {
  const context = await getTenantContext();
  
  // In development or non-strict mode, allow any tenant access
  if (process.env.NODE_ENV !== "production" || process.env.REQUIRE_AUTH !== "true") {
    return true;
  }
  
  // In strict production, user must be authenticated and belong to the tenant
  return context.isAuthenticated && context.tenantId === requestedTenantId;
}

export default {
  getTenantContext,
  getServerTenantId,
  requireTenantContext,
  validateTenantAccess,
};
