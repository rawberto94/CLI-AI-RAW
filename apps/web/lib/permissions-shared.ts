/**
 * Client-safe RBAC permission map and helpers (no Prisma / Node APIs).
 * Server code may import from `@/lib/permissions` which re-exports these
 * plus async DB-backed checks.
 */

/** Canonical roles, lowest → highest privilege */
export const RBAC_ROLES = ['viewer', 'member', 'manager', 'admin', 'owner'] as const;
export type RbacRole = (typeof RBAC_ROLES)[number];

/**
 * Permission definitions by role
 * Higher roles inherit permissions from lower roles
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Viewer - read-only access
  viewer: [
    'contracts:view',
    'dashboard:view',
    'reports:view',
    'chat:view',
    'policy:read',
  ],
  
  // Member - standard team member
  member: [
    // Inherits viewer
    'contracts:view',
    'dashboard:view',
    'reports:view',
    'chat:view',
    // Member-specific
    'contracts:create',
    'contracts:edit_own',
    'chat:send',
    'collaborators:view',
    'comments:create',
    'comments:edit_own',
    'policy:read',
  ],
  
  // Manager - team/department lead
  manager: [
    // Inherits member
    'contracts:view',
    'contracts:create',
    'contracts:edit_own',
    'dashboard:view',
    'reports:view',
    'chat:view',
    'chat:send',
    'collaborators:view',
    'comments:create',
    'comments:edit_own',
    // Manager-specific
    'contracts:edit',
    'contracts:delete',
    'contracts:manage',
    'contracts:assign',
    'users:view',
    'users:invite',
    'collaborators:manage',
    'reports:create',
    'reports:export',
    'analytics:view',
    'workflow:manage',
    'comments:moderate',
    'policy:read',
    'policy:manage',
    'policy:waive',
  ],
  
  // Admin - full administrative access
  admin: [
    // All permissions
    'contracts:view',
    'contracts:create',
    'contracts:edit',
    'contracts:edit_own',
    'contracts:delete',
    'contracts:manage',
    'contracts:assign',
    'dashboard:view',
    'reports:view',
    'reports:create',
    'reports:export',
    'chat:view',
    'chat:send',
    'users:view',
    'users:invite',
    'users:manage',
    'users:delete',
    'collaborators:view',
    'collaborators:manage',
    'groups:manage',
    'analytics:view',
    'analytics:export',
    'workflow:manage',
    'settings:view',
    'settings:manage',
    'security:view',
    'audit:view',
    'audit:export',
    'comments:create',
    'comments:edit_own',
    'comments:moderate',
    'comments:delete',
    'policy:read',
    'policy:manage',
    'policy:waive',
  ],
  
  // Owner - tenant owner with full control
  owner: [
    // All permissions including billing and tenant management
    'contracts:view',
    'contracts:create',
    'contracts:edit',
    'contracts:edit_own',
    'contracts:delete',
    'contracts:manage',
    'contracts:assign',
    'dashboard:view',
    'reports:view',
    'reports:create',
    'reports:export',
    'chat:view',
    'chat:send',
    'users:view',
    'users:invite',
    'users:manage',
    'users:delete',
    'users:roles',
    'collaborators:view',
    'collaborators:manage',
    'groups:manage',
    'analytics:view',
    'analytics:export',
    'workflow:manage',
    'settings:view',
    'settings:manage',
    'security:view',
    'security:manage',
    'audit:view',
    'audit:export',
    'billing:view',
    'billing:manage',
    'tenant:manage',
    'api:manage',
    'comments:create',
    'comments:edit_own',
    'comments:moderate',
    'comments:delete',
    'policy:read',
    'policy:manage',
    'policy:waive',
  ],
};

/**
 * Normalize role strings from JWT/DB (handles ADMIN, super_admin aliases).
 * Unknown / missing roles default to the least privilege role: viewer.
 */
export function normalizeRole(role?: string | null): RbacRole {
  if (!role || typeof role !== 'string') {
    return 'viewer';
  }

  const lower = role.trim().toLowerCase();
  const aliases: Record<string, RbacRole> = {
    superadmin: 'owner',
    super_admin: 'owner',
    'super-admin': 'owner',
    administrator: 'admin',
    user: 'member',
    guest: 'viewer',
    readonly: 'viewer',
    'read-only': 'viewer',
  };

  const mapped = aliases[lower] ?? lower;
  if ((RBAC_ROLES as readonly string[]).includes(mapped)) {
    return mapped as RbacRole;
  }
  return 'viewer';
}

/**
 * Sync permission check from a role string (no DB). Prefer this in hot paths.
 */
export function hasPermissionForRole(role: string | null | undefined, permission: string): boolean {
  const normalized = normalizeRole(role);
  return (ROLE_PERMISSIONS[normalized] || []).includes(permission);
}

export function roleHasAnyPermission(
  role: string | null | undefined,
  permissions: string[],
): boolean {
  return permissions.some((p) => hasPermissionForRole(role, p));
}

export function roleHasAllPermissions(
  role: string | null | undefined,
  permissions: string[],
): boolean {
  return permissions.every((p) => hasPermissionForRole(role, p));
}

/**
 * Get role hierarchy level
 * @param role - The role name
 * @returns Numeric level (higher = more permissions)
 */
export function getRoleLevel(role: string): number {
  const levels: Record<string, number> = {
    viewer: 1,
    member: 2,
    manager: 3,
    admin: 4,
    owner: 5,
  };
  return levels[normalizeRole(role)] || 0;
}

/**
 * Check if a role can manage another role
 * @param actorRole - The role of the user performing the action
 * @param targetRole - The role being managed
 * @returns true if the actor can manage the target role
 */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  const actorLevel = getRoleLevel(actorRole);
  const targetLevel = getRoleLevel(targetRole);
  // Can only manage roles below your own level
  return actorLevel > targetLevel;
}

/** Tenant admin surface (admin console, SSO config, security) */
export function isTenantAdminRole(role?: string | null): boolean {
  const n = normalizeRole(role);
  return n === 'admin' || n === 'owner';
}

/** Platform-level or tenant admin */
export function isElevatedAdminRole(role?: string | null): boolean {
  return isTenantAdminRole(role) || role === 'superadmin' || role === 'super_admin';
}

/**
 * Get all available permissions
 */
export function getAllPermissions(): string[] {
  const allPermissions = new Set<string>();
  Object.values(ROLE_PERMISSIONS).forEach(permissions => {
    permissions.forEach(p => allPermissions.add(p));
  });
  return Array.from(allPermissions).sort();
}

/**
 * Get permissions for a specific role
 */
export function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[normalizeRole(role)] || [];
}

/** Contract ACL level that a role may exercise when no explicit grants exist */
export function maxContractAclLevelForRole(role: string | null | undefined): 'VIEW' | 'COMMENT' | 'EDIT' | 'ADMIN' | null {
  if (hasPermissionForRole(role, 'contracts:delete') || hasPermissionForRole(role, 'contracts:manage')) {
    return 'ADMIN';
  }
  if (hasPermissionForRole(role, 'contracts:edit') || hasPermissionForRole(role, 'contracts:edit_own')) {
    return 'EDIT';
  }
  if (hasPermissionForRole(role, 'comments:create')) {
    return 'COMMENT';
  }
  if (hasPermissionForRole(role, 'contracts:view')) {
    return 'VIEW';
  }
  return null;
}

/**
 * Permission categories for UI display
 */
export const PERMISSION_CATEGORIES = {
  contracts: {
    label: 'Contracts',
    permissions: [
      { key: 'contracts:view', label: 'View contracts' },
      { key: 'contracts:create', label: 'Create contracts' },
      { key: 'contracts:edit', label: 'Edit any contract' },
      { key: 'contracts:edit_own', label: 'Edit own contracts' },
      { key: 'contracts:delete', label: 'Delete contracts' },
      { key: 'contracts:manage', label: 'Manage contract settings' },
      { key: 'contracts:assign', label: 'Assign contracts to users' },
    ],
  },
  users: {
    label: 'Users',
    permissions: [
      { key: 'users:view', label: 'View team members' },
      { key: 'users:invite', label: 'Invite new users' },
      { key: 'users:manage', label: 'Manage users' },
      { key: 'users:delete', label: 'Remove users' },
      { key: 'users:roles', label: 'Change user roles' },
    ],
  },
  collaborators: {
    label: 'External Collaborators',
    permissions: [
      { key: 'collaborators:view', label: 'View collaborators' },
      { key: 'collaborators:manage', label: 'Manage collaborators' },
    ],
  },
  reports: {
    label: 'Reports & Analytics',
    permissions: [
      { key: 'reports:view', label: 'View reports' },
      { key: 'reports:create', label: 'Create reports' },
      { key: 'reports:export', label: 'Export reports' },
      { key: 'analytics:view', label: 'View analytics' },
      { key: 'analytics:export', label: 'Export analytics data' },
    ],
  },
  settings: {
    label: 'Settings',
    permissions: [
      { key: 'settings:view', label: 'View settings' },
      { key: 'settings:manage', label: 'Manage settings' },
      { key: 'security:view', label: 'View security settings' },
      { key: 'security:manage', label: 'Manage security' },
    ],
  },
  audit: {
    label: 'Audit & Compliance',
    permissions: [
      { key: 'audit:view', label: 'View audit logs' },
      { key: 'audit:export', label: 'Export audit logs' },
    ],
  },
  billing: {
    label: 'Billing',
    permissions: [
      { key: 'billing:view', label: 'View billing' },
      { key: 'billing:manage', label: 'Manage billing' },
    ],
  },
  system: {
    label: 'System',
    permissions: [
      { key: 'tenant:manage', label: 'Manage organization' },
      { key: 'api:manage', label: 'Manage API keys' },
      { key: 'groups:manage', label: 'Manage groups' },
      { key: 'workflow:manage', label: 'Manage workflows' },
    ],
  },
} as const;
