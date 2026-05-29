/**
 * Contract ACL — permission checks for contract read + write paths.
 *
 * Rules (apply to both read and write):
 *   1. Tenant admins / owners / super_admins → always allowed.
 *   2. Contract uploader (contract.uploadedBy === userId) → always allowed.
 *   3. A user with an active, non-expired ContractUserAccess / ContractGroupAccess
 *      whose `accessLevel` satisfies the required level → allowed.
 *   4. A user with an active, non-expired DocumentShare whose `permission`
 *      satisfies the required level → allowed.
 *
 * If no explicit ContractUserAccess / ContractGroupAccess / DocumentShare rows
 * exist for the contract at all, we fall back to "any tenant member can access"
 * so we don't regress tenants that never used access controls. The moment an
 * owner creates even one explicit grant/share, the ACL becomes authoritative.
 *
 * Caller is responsible for the tenant scope check (Contract.tenantId); this
 * helper assumes you've already verified the contract belongs to ctx.tenantId.
 */

import { prisma } from '@/lib/prisma';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { logger } from '@/lib/logger';

type Permission = 'VIEW' | 'COMMENT' | 'EDIT' | 'ADMIN';
type ContractAccessLevel = 'view' | 'edit' | 'manage' | 'admin';

const LEVEL: Record<Permission, number> = {
  VIEW: 0,
  COMMENT: 1,
  EDIT: 2,
  ADMIN: 3,
};

const CONTRACT_ACCESS_LEVEL: Record<ContractAccessLevel, number> = {
  view: LEVEL.VIEW,
  edit: LEVEL.EDIT,
  manage: LEVEL.ADMIN,
  admin: LEVEL.ADMIN,
};

export type AclDecision =
  | { allowed: true; reason: 'owner' | 'role' | 'contract-access' | 'share' | 'no-shares' }
  | { allowed: false; reason: 'forbidden' };

function contractAccessMeetsRequired(accessLevel: string | null | undefined, required: Permission): boolean {
  const normalized = String(accessLevel || '').toLowerCase() as ContractAccessLevel;
  const have = CONTRACT_ACCESS_LEVEL[normalized];
  return typeof have === 'number' && have >= LEVEL[required];
}

async function checkExplicitContractAccess(args: {
  contractId: string;
  userId: string;
  required: Permission;
}): Promise<{ hasExplicitAccessRows: boolean; allowed: boolean }> {
  const { contractId, userId, required } = args;
  const now = new Date();

  const [anyUserAccess, anyGroupAccess, directAccess, groupMemberships] = await Promise.all([
    prisma.contractUserAccess.findFirst({
      where: { contractId },
      select: { id: true },
    }),
    prisma.contractGroupAccess.findFirst({
      where: { contractId },
      select: { id: true },
    }),
    prisma.contractUserAccess.findFirst({
      where: {
        contractId,
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: { accessLevel: true },
    }),
    prisma.userGroupMember.findMany({
      where: { userId },
      select: { groupId: true },
    }),
  ]);

  if (contractAccessMeetsRequired(directAccess?.accessLevel, required)) {
    return { hasExplicitAccessRows: true, allowed: true };
  }

  const groupIds = groupMemberships.map((membership) => membership.groupId);
  if (groupIds.length > 0) {
    const groupAccess = await prisma.contractGroupAccess.findMany({
      where: {
        contractId,
        groupId: { in: groupIds },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: { accessLevel: true },
    });

    if (groupAccess.some((access) => contractAccessMeetsRequired(access.accessLevel, required))) {
      return { hasExplicitAccessRows: true, allowed: true };
    }
  }

  return { hasExplicitAccessRows: Boolean(anyUserAccess || anyGroupAccess), allowed: false };
}

async function checkPermission(args: {
  contractId: string;
  tenantId: string;
  userId: string;
  userRole?: string;
  required: Permission;
}): Promise<AclDecision> {
  const { contractId, tenantId, userId, userRole, required } = args;

  if (userRole === 'admin' || userRole === 'owner' || userRole === 'super_admin') {
    return { allowed: true, reason: 'role' };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { uploadedBy: true },
  });
  if (!contract) {
    return { allowed: false, reason: 'forbidden' };
  }

  if (contract.uploadedBy && contract.uploadedBy === userId) {
    return { allowed: true, reason: 'owner' };
  }

  const explicitAccess = await checkExplicitContractAccess({ contractId, userId, required });
  if (explicitAccess.allowed) {
    return { allowed: true, reason: 'contract-access' };
  }

  const shares = await prisma.documentShare.findMany({
    where: {
      tenantId,
      documentId: contractId,
      documentType: 'contract',
      isActive: true,
    },
    select: { sharedWith: true, permission: true, expiresAt: true },
  });

  if (!explicitAccess.hasExplicitAccessRows && shares.length === 0) {
    return { allowed: true, reason: 'no-shares' };
  }

  const now = Date.now();
  const myShare = shares.find(
    (s) => s.sharedWith === userId && (!s.expiresAt || s.expiresAt.getTime() > now),
  );
  if (!myShare) {
    logDenial({ contractId, tenantId, userId, required });
    return { allowed: false, reason: 'forbidden' };
  }

  const have = LEVEL[(myShare.permission as Permission) ?? 'VIEW'] ?? 0;
  const need = LEVEL[required];
  if (have >= need) return { allowed: true, reason: 'share' };
  logDenial({ contractId, tenantId, userId, required });
  return { allowed: false, reason: 'forbidden' };
}

/**
 * Fire-and-forget audit log for a denied permission check. Caller keeps its
 * hot path synchronous; we swallow errors so a logging failure never breaks
 * the user-facing 403/404.
 */
function logDenial(args: {
  contractId: string;
  tenantId: string;
  userId: string;
  required: Permission;
}) {
  auditLog({
    action: AuditAction.PERMISSION_DENIED,
    userId: args.userId,
    tenantId: args.tenantId,
    resourceId: args.contractId,
    resourceType: 'contract',
    metadata: { required: args.required },
  }).catch((err) => {
    logger.error('[contract-acl] audit log failed', err);
  });
}

export function checkContractWritePermission(args: {
  contractId: string;
  tenantId: string;
  userId: string;
  userRole?: string;
  required: Permission;
}) {
  return checkPermission(args);
}

export function checkContractReadPermission(args: {
  contractId: string;
  tenantId: string;
  userId: string;
  userRole?: string;
}) {
  return checkPermission({ ...args, required: 'VIEW' });
}
