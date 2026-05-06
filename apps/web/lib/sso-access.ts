import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface SSOSignInMapping {
  tenantId: string;
  role: string;
}

/**
 * Resolve which tenant/role an SSO user is allowed to access.
 *
 * Safety rule: if the same email has multiple pending invitations, fail closed
 * instead of attaching the user to an arbitrary tenant.
 */
export async function resolveSSOSignInMapping(
  email: string | null | undefined
): Promise<SSOSignInMapping | null> {
  if (!email) {
    return null;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, tenantId: true, role: true, status: true },
  });

  if (existingUser) {
    if (existingUser.status !== 'ACTIVE') {
      return null;
    }

    return { tenantId: existingUser.tenantId, role: existingUser.role };
  }

  const invitations = await prisma.teamInvitation.findMany({
    where: {
      email,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    select: { tenantId: true, role: true },
  });

  if (invitations.length === 1) {
    return invitations[0];
  }

  if (invitations.length > 1) {
    logger.warn('[Auth] Ambiguous pending invitations for SSO sign-in', {
      email,
      invitationCount: invitations.length,
    });
    return null;
  }

  const autoProvision = process.env.SSO_AUTO_PROVISION === 'true';
  const defaultTenantId = process.env.SSO_DEFAULT_TENANT_ID;

  if (autoProvision && defaultTenantId) {
    return { tenantId: defaultTenantId, role: 'member' };
  }

  return null;
}