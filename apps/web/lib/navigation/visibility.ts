export type NavigationAudience = 'all' | 'operator' | 'legal' | 'commercial' | 'oversight' | 'admin';

const ADMIN_ROLES = new Set(['owner', 'admin', 'super_admin', 'superadmin']);
const LEGAL_ROLES = new Set(['legal', 'legal_review', 'legal_counsel', 'attorney', 'compliance']);
const COMMERCIAL_ROLES = new Set(['finance', 'procurement', 'sourcing', 'buyer']);
const OVERSIGHT_ROLES = new Set(['manager']);

export function normalizeNavigationRole(role?: string): string {
  return role?.toLowerCase().trim() || 'member';
}

export function isAdminNavigationRole(role?: string, options?: { viewingAsClient?: boolean }): boolean {
  return ADMIN_ROLES.has(normalizeNavigationRole(role)) && !options?.viewingAsClient;
}

export function getNavigationAudiences(role?: string, options?: { viewingAsClient?: boolean }): Set<NavigationAudience> {
  const normalizedRole = normalizeNavigationRole(role);
  const audiences = new Set<NavigationAudience>(['all']);

  if (normalizedRole !== 'viewer') {
    audiences.add('operator');
  }

  if (LEGAL_ROLES.has(normalizedRole)) {
    audiences.add('legal');
  }

  if (COMMERCIAL_ROLES.has(normalizedRole)) {
    audiences.add('commercial');
  }

  if (OVERSIGHT_ROLES.has(normalizedRole)) {
    audiences.add('oversight');
    audiences.add('legal');
    audiences.add('commercial');
  }

  if (ADMIN_ROLES.has(normalizedRole)) {
    audiences.add('oversight');
    audiences.add('legal');
    audiences.add('commercial');

    if (!options?.viewingAsClient) {
      audiences.add('admin');
    }
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