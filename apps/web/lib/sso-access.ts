import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { normalizeRole } from '@/lib/permissions';
import {
  globalSsoAllowedDomains,
  isEmailDomainAllowed,
  resolveRoleFromGroups,
} from '@/lib/auth/sso-utils';
import { getTenantSsoDomainAllowlist } from '@/lib/auth/sso-provider-store';

export interface SSOSignInMapping {
  tenantId: string;
  role: string;
}

export interface ResolveSSOOptions {
  /** Prefer this tenant when invitations are ambiguous (from RelayState) */
  preferredTenantId?: string;
  /** IdP groups for role mapping on JIT provision */
  groups?: string[];
  /** Provider-level domain allowlist */
  allowedDomains?: string[];
  /** Provider group → role map */
  groupRoleMapping?: Record<string, string>;
  /** When true, existing user role may be updated from groups */
  syncRolesFromGroups?: boolean;
}

/**
 * Resolve which tenant/role an SSO user is allowed to access.
 *
 * Safety rules:
 * - Inactive users denied
 * - Multiple pending invitations → fail closed (unless preferredTenantId matches exactly one)
 * - Domain allowlists enforced (provider, tenant, global env)
 * - Auto-provision only with SSO_AUTO_PROVISION + SSO_DEFAULT_TENANT_ID
 */
export async function resolveSSOSignInMapping(
  email: string | null | undefined,
  options: ResolveSSOOptions = {},
): Promise<SSOSignInMapping | null> {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Global domain gate (optional)
  const globalDomains = globalSsoAllowedDomains();
  if (globalDomains.length > 0 && !isEmailDomainAllowed(normalizedEmail, globalDomains)) {
    logger.warn('[Auth] SSO email domain blocked by SSO_ALLOWED_DOMAINS', { email: normalizedEmail });
    return null;
  }

  // Provider domain gate
  if (
    options.allowedDomains?.length &&
    !isEmailDomainAllowed(normalizedEmail, options.allowedDomains)
  ) {
    logger.warn('[Auth] SSO email domain blocked by provider allowlist', { email: normalizedEmail });
    return null;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, tenantId: true, role: true, status: true },
  });

  if (existingUser) {
    if (existingUser.status !== 'ACTIVE') {
      return null;
    }

    // Tenant domain allowlist for the user's tenant
    const tenantDomains = await getTenantSsoDomainAllowlist(existingUser.tenantId);
    if (tenantDomains.length > 0 && !isEmailDomainAllowed(normalizedEmail, tenantDomains)) {
      logger.warn('[Auth] SSO email domain blocked by tenant allowlist', {
        email: normalizedEmail,
        tenantId: existingUser.tenantId,
      });
      return null;
    }

    // Optional: preferred tenant must match existing user tenant
    if (options.preferredTenantId && options.preferredTenantId !== existingUser.tenantId) {
      logger.warn('[Auth] SSO preferred tenant does not match existing user tenant', {
        email: normalizedEmail,
        preferredTenantId: options.preferredTenantId,
        userTenantId: existingUser.tenantId,
      });
      return null;
    }

    let role = existingUser.role;
    const syncRoles =
      options.syncRolesFromGroups === true || process.env.SSO_SYNC_ROLES === 'true';
    if (syncRoles && options.groups?.length && options.groupRoleMapping) {
      role = resolveRoleFromGroups(options.groups, options.groupRoleMapping, existingUser.role);
      if (role !== existingUser.role) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role },
        }).catch((err) => {
          logger.warn('[Auth] Failed to sync SSO role from groups', { error: err });
        });
      }
    }

    return { tenantId: existingUser.tenantId, role };
  }

  let invitations = await prisma.teamInvitation.findMany({
    where: {
      email: normalizedEmail,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    select: { tenantId: true, role: true },
  });

  if (options.preferredTenantId) {
    const preferred = invitations.filter((i) => i.tenantId === options.preferredTenantId);
    if (preferred.length === 1) {
      invitations = preferred;
    } else if (preferred.length === 0 && invitations.length > 1) {
      // Preferred tenant has no invite and multiple others — fail closed
      logger.warn('[Auth] Ambiguous invitations and preferred tenant has none', {
        email: normalizedEmail,
        preferredTenantId: options.preferredTenantId,
      });
      return null;
    } else if (preferred.length === 0 && invitations.length === 0) {
      // fall through to auto-provision for preferred tenant
    } else if (preferred.length > 1) {
      return null;
    }
  }

  if (invitations.length === 1) {
    const inv = invitations[0];
    const tenantDomains = await getTenantSsoDomainAllowlist(inv.tenantId);
    if (tenantDomains.length > 0 && !isEmailDomainAllowed(normalizedEmail, tenantDomains)) {
      return null;
    }
    return { tenantId: inv.tenantId, role: inv.role };
  }

  if (invitations.length > 1) {
    logger.warn('[Auth] Ambiguous pending invitations for SSO sign-in', {
      email: normalizedEmail,
      invitationCount: invitations.length,
    });
    return null;
  }

  const autoProvision = process.env.SSO_AUTO_PROVISION === 'true';
  const defaultTenantId = options.preferredTenantId || process.env.SSO_DEFAULT_TENANT_ID;

  if (autoProvision && defaultTenantId) {
    const tenantDomains = await getTenantSsoDomainAllowlist(defaultTenantId);
    if (tenantDomains.length > 0 && !isEmailDomainAllowed(normalizedEmail, tenantDomains)) {
      return null;
    }

    const role = resolveRoleFromGroups(
      options.groups,
      options.groupRoleMapping,
      'member',
    );

    return { tenantId: defaultTenantId, role: normalizeRole(role) };
  }

  return null;
}
