/**
 * Role-Based Access Control (RBAC) Permissions
 * 
 * Fine-grained permission system based on user roles
 * Supports: owner, admin, manager, member, viewer
 */

import { prisma } from '@/lib/prisma';

/**
 * Permission definitions by role
 * Higher roles inherit permissions from lower roles
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  // Viewer - read-only access
  viewer: [
    'contracts:view',
    'dashboard:view',
    'reports:view',
    'chat:view',
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
  ],
};

/**
 * Check if a user has a specific permission
 * @param userId - The user's ID
 * @param permission - The permission to check (e.g., 'contracts:view')
 * @returns true if the user has the permission
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    
    if (!user || user.status !== 'active') {
      return false;
    }
    
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    return rolePermissions.includes(permission);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Get all permissions for a user
 * @param userId - The user's ID
 * @returns Array of permission strings
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    
    if (!user || user.status !== 'active') {
      return [];
    }
    
    return ROLE_PERMISSIONS[user.role] || [];
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if a user has any of the specified permissions
 * @param userId - The user's ID
 * @param permissions - Array of permissions to check
 * @returns true if the user has any of the permissions
 */
export async function hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
  try {
    const userPermissions = await getUserPermissions(userId);
    return permissions.some(p => userPermissions.includes(p));
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

/**
 * Check if a user has all of the specified permissions
 * @param userId - The user's ID
 * @param permissions - Array of permissions to check
 * @returns true if the user has all of the permissions
 */
export async function hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
  try {
    const userPermissions = await getUserPermissions(userId);
    return permissions.every(p => userPermissions.includes(p));
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
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
  return levels[role] || 0;
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
  return ROLE_PERMISSIONS[role] || [];
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
