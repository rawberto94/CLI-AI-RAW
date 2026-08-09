'use client';

/**
 * Declarative UI gate for RBAC.
 * Server APIs remain authoritative — this only hides/disables controls.
 */

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { RbacRole } from '@/lib/permissions-shared';

export interface PermissionGateProps {
  /** Single permission required */
  permission?: string;
  /** Any of these permissions */
  anyOf?: string[];
  /** All of these permissions */
  allOf?: string[];
  /** Minimum role level */
  minRole?: RbacRole | string;
  /** Render when allowed */
  children: ReactNode;
  /** Optional fallback when denied (default: null) */
  fallback?: ReactNode;
  /** If true, render children disabled instead of hiding */
  disableWhenDenied?: boolean;
}

export function PermissionGate({
  permission,
  anyOf,
  allOf,
  minRole,
  children,
  fallback = null,
  disableWhenDenied = false,
}: PermissionGateProps) {
  const perms = usePermissions();

  if (perms.loading) {
    return disableWhenDenied ? (
      <span className="pointer-events-none opacity-50">{children}</span>
    ) : null;
  }

  let allowed = true;
  if (permission) allowed = allowed && perms.can(permission);
  if (anyOf?.length) allowed = allowed && perms.canAny(anyOf);
  if (allOf?.length) allowed = allowed && perms.canAll(allOf);
  if (minRole) allowed = allowed && perms.atLeast(minRole);

  if (allowed) return <>{children}</>;
  if (disableWhenDenied) {
    return <span className="pointer-events-none opacity-50">{children}</span>;
  }
  return <>{fallback}</>;
}
