/**
 * Server RBAC permissions — re-exports client-safe helpers and adds DB-backed checks.
 */

import { prisma } from '@/lib/prisma';
import {
  ROLE_PERMISSIONS,
  hasPermissionForRole,
  normalizeRole,
} from '@/lib/permissions-shared';

export * from '@/lib/permissions-shared';

/**
 * Check if a user has a specific permission (DB-backed ACTIVE status check).
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return false;
    }

    return hasPermissionForRole(user.role, permission);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Get all permissions for a user (DB-backed).
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return [];
    }

    return ROLE_PERMISSIONS[normalizeRole(user.role)] || [];
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if a user has any of the specified permissions
 */
export async function hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
  try {
    const userPermissions = await getUserPermissions(userId);
    return permissions.some((p) => userPermissions.includes(p));
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

/**
 * Check if a user has all of the specified permissions
 */
export async function hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
  try {
    const userPermissions = await getUserPermissions(userId);
    return permissions.every((p) => userPermissions.includes(p));
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}
