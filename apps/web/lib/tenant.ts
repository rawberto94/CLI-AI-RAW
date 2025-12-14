/**
 * Tenant Management Utilities
 * Production-ready multi-tenant isolation
 * 
 * NOTE: Server-side tenant context functions are in tenant-server.ts
 * This file contains only client-safe utilities
 */

// ============================================
// Client-Side Tenant Utilities
// ============================================

// Get tenant ID from environment or default (client-side)
// Priority: viewAsTenantId (admin viewing as client) > localStorage > env > default
export function getTenantId(): string {
  if (typeof window !== "undefined") {
    // First check if admin is viewing as a client
    const viewAsTenantId = sessionStorage.getItem("viewAsTenantId");
    if (viewAsTenantId) {
      return viewAsTenantId;
    }
    // Client-side: check localStorage or use default
    return (
      localStorage.getItem("tenantId") ||
      process.env.NEXT_PUBLIC_TENANT_ID ||
      "demo"
    );
  }
  // Server-side: use environment variable
  return process.env.NEXT_PUBLIC_TENANT_ID || "demo";
}

// Check if currently viewing as a different tenant (admin mode)
export function isViewingAsClient(): boolean {
  if (typeof window === "undefined") return false;
  return !!sessionStorage.getItem("viewAsTenantId");
}

// Get the tenant name when viewing as client
export function getViewAsClientName(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("viewAsTenantName");
}

// Set tenant ID (client-side only)
export function setTenantId(tenantId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("tenantId", tenantId);
  }
}

// Ensure tenant ID exists (creates default if needed)
export function ensureTenantId(): string {
  const tenantId = getTenantId();
  if (typeof window !== "undefined" && !localStorage.getItem("tenantId")) {
    localStorage.setItem("tenantId", tenantId);
  }
  return tenantId;
}

// Get tenant headers for API requests
export function tenantHeaders(
  extras?: Record<string, string>
): Record<string, string> {
  return {
    ...(extras || {}),
    "X-Tenant-ID": getTenantId(),
  };
}

// Tenant configuration
export interface TenantConfig {
  id: string;
  name: string;
  features: {
    aiChat: boolean;
    batchUpload: boolean;
    advancedAnalytics: boolean;
  };
}

// Get tenant configuration
export function getTenantConfig(): TenantConfig {
  const tenantId = getTenantId();

  // Default configuration
  return {
    id: tenantId,
    name: tenantId === "demo" ? "Demo Tenant" : tenantId,
    features: {
      aiChat: true,
      batchUpload: true,
      advancedAnalytics: true,
    },
  };
}

const tenantUtils = {
  getTenantId,
  setTenantId,
  ensureTenantId,
  tenantHeaders,
  getTenantConfig,
  isViewingAsClient,
  getViewAsClientName,
};
export default tenantUtils;
