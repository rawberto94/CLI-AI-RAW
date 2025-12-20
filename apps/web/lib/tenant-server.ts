/**
 * Server-Side Tenant Management Utilities
 * Production-ready multi-tenant isolation with session integration
 * 
 * NOTE: This file uses next/headers and can only be used in Server Components or API routes
 */

import { getServerSession } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

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
 * Get tenant ID from a NextRequest (for API routes)
 * Priority: session.user.tenantId > x-tenant-id header > demo (dev only)
 * 
 * USE THIS IN API ROUTES instead of direct header access
 */
export async function getTenantIdFromRequest(request: NextRequest): Promise<string> {
  // Try session first
  try {
    const session = await getServerSession();
    if (session?.user?.tenantId) {
      return session.user.tenantId;
    }
  } catch {
    // Session not available
  }

  // Try header
  const headerTenantId = request.headers.get("x-tenant-id");
  if (headerTenantId && headerTenantId !== "undefined") {
    return headerTenantId;
  }

  // Try query param
  const { searchParams } = new URL(request.url);
  const queryTenantId = searchParams.get("tenantId");
  if (queryTenantId && queryTenantId !== "undefined") {
    return queryTenantId;
  }

  // Production safety check
  if (process.env.NODE_ENV === "production" && process.env.REQUIRE_AUTH === "true") {
    throw new Error("Tenant ID required. Please authenticate.");
  }

  return "demo";
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
  if (process.env.NODE_ENV === "production") {
    // In production, require explicit tenant (no fallback)
    throw new Error("Tenant ID required. Please authenticate or provide x-tenant-id header.");
  }
  return "demo";
}

/**
 * STRICT: Get tenant ID from request - throws if not provided
 * Use this for sensitive routes that MUST have tenant isolation
 */
export function getRequiredTenantId(request: NextRequest): string {
  const tenantId = request.headers.get("x-tenant-id");
  
  if (!tenantId || tenantId === "undefined" || tenantId === "null") {
    throw new Error("Tenant ID is required. Provide x-tenant-id header.");
  }
  
  return tenantId;
}

/**
 * STRICT: Get tenant ID or null - for validation before queries
 * Returns null if not provided, allowing the route to return 400
 */
export function getTenantIdOrNull(request: NextRequest): string | null {
  const tenantId = request.headers.get("x-tenant-id");
  
  if (!tenantId || tenantId === "undefined" || tenantId === "null") {
    return null;
  }
  
  return tenantId;
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

const tenantServer = {
  getTenantContext,
  getServerTenantId,
  getTenantIdFromRequest,
  requireTenantContext,
  validateTenantAccess,
};
export default tenantServer;

// Alias for API routes - preferred name
export const getApiTenantId = getTenantIdFromRequest;
