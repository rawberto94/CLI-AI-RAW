'use client';

/**
 * Client-side RBAC helpers for UI gating.
 * Server APIs remain the source of truth — never trust the client alone.
 */

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  getPermissionsForRole,
  getRoleLevel,
  hasPermissionForRole,
  isTenantAdminRole,
  normalizeRole,
  roleHasAnyPermission,
  type RbacRole,
} from '@/lib/permissions-shared';

export function usePermissions() {
  const { data: session, status } = useSession();
  const role = normalizeRole(session?.user?.role);

  return useMemo(() => {
    const permissions = getPermissionsForRole(role);

    return {
      role: role as RbacRole,
      permissions,
      loading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      isAdmin: isTenantAdminRole(role),
      isOwner: role === 'owner',
      isViewer: role === 'viewer',
      can: (permission: string) => hasPermissionForRole(role, permission),
      canAny: (perms: string[]) => roleHasAnyPermission(role, perms),
      canAll: (perms: string[]) => perms.every((p) => hasPermissionForRole(role, p)),
      atLeast: (minRole: RbacRole | string) => getRoleLevel(role) >= getRoleLevel(minRole),
      // Common product shortcuts
      canCreateContracts: hasPermissionForRole(role, 'contracts:create'),
      canEditContracts: roleHasAnyPermission(role, ['contracts:edit', 'contracts:edit_own']),
      canDeleteContracts: roleHasAnyPermission(role, ['contracts:delete', 'contracts:manage']),
      canManageUsers: hasPermissionForRole(role, 'users:manage'),
      canViewAudit: hasPermissionForRole(role, 'audit:view'),
      canSendChat: hasPermissionForRole(role, 'chat:send'),
    };
  }, [role, status]);
}
