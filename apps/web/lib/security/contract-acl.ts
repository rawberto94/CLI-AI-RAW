/**
 * Contract ACL — permission checks for contract read + write paths.
 *
 * Rules (apply to both read and write):
 *   1. Tenant admins / owners / super_admins → always allowed.
 *   2. Contract uploader (contract.uploadedBy === userId) → always allowed.
 *   3. A user with an active, non-expired DocumentShare whose `permission`
 *      satisfies the required level → allowed.
 *
 * If no DocumentShare rows exist for the contract at all, we fall back to
 * "any tenant member can access" so we don't regress tenants that never used
 * the sharing feature. The moment an owner creates even one share, the ACL
 * becomes authoritative.
 *
 * Caller is responsible for the tenant scope check (Contract.tenantId); this
 * helper assumes you've already verified the contract belongs to ctx.tenantId.
 */

import { prisma } from '@/lib/prisma';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { logger } from '@/lib/logger';

type Permission = 'VIEW' | 'COMMENT' | 'EDIT' | 'ADMIN';

const LEVEL: Record<Permission, number> = {
  VIEW: 0,
  COMMENT: 1,
  EDIT: 2,
  ADMIN: 3,
};

export type AclDecision =
  | { allowed: true; reason: 'owner' | 'role' | 'share' | 'no-shares' }
  | { allowed: false; reason: 'forbidden' };

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

  const shares = await prisma.documentShare.findMany({
    where: {
      tenantId,
      documentId: contractId,
      documentType: 'contract',
      isActive: true,
    },
    select: { sharedWith: true, permission: true, expiresAt: true },
  });

  if (shares.length === 0) {
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
