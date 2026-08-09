import { isTenantAdminRole, normalizeRole } from '@/lib/permissions';

export type NavigationAudience = 'all' | 'operator' | 'legal' | 'commercial' | 'oversight' | 'admin';

const LEGAL_ROLES = new Set(['legal', 'legal_review', 'legal_counsel', 'attorney', 'compliance']);
const COMMERCIAL_ROLES = new Set(['finance', 'procurement', 'sourcing', 'buyer']);

export function normalizeNavigationRole(role?: string): string {
  // Align with RBAC: unknown → viewer (least privilege for UI too)
  return normalizeRole(role);
}

export function isAdminNavigationRole(role?: string, options?: { viewingAsClient?: boolean }): boolean {
  return isTenantAdminRole(role) && !options?.viewingAsClient;
}

export function getNavigationAudiences(role?: string, options?: { viewingAsClient?: boolean }): Set<NavigationAudience> {
  const normalizedRole = normalizeNavigationRole(role);
  const audiences = new Set<NavigationAudience>(['all']);

  // Viewers: browse-only — no operator (create/upload) surfaces
  if (normalizedRole !== 'viewer') {
    audiences.add('operator');
  }

  if (LEGAL_ROLES.has(normalizedRole)) {
    audiences.add('legal');
  }

  if (COMMERCIAL_ROLES.has(normalizedRole)) {
    audiences.add('commercial');
  }

  // Manager+ get oversight + commercial/legal tool surfaces
  if (normalizedRole === 'manager' || isTenantAdminRole(normalizedRole)) {
    audiences.add('oversight');
    audiences.add('legal');
    audiences.add('commercial');
  }

  if (isTenantAdminRole(normalizedRole) && !options?.viewingAsClient) {
    audiences.add('admin');
  }

  return audiences;
}

export function canAccessNavigationAudience(
  itemAudiences: NavigationAudience[] | undefined,
  activeAudiences: Set<NavigationAudience>
): boolean {
  if (!itemAudiences || itemAudiences.length === 0) {
    return true;
  }

  return itemAudiences.some((audience) => activeAudiences.has(audience));
}
