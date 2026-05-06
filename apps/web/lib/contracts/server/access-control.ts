import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { sendEmail } from '@/lib/email/email-service';
import { emailTemplates } from '@/lib/email/templates';
import { logger } from '@/lib/logger';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { auditLog, AuditAction } from '@/lib/security/audit';

import type { ContractApiContext } from '@/lib/contracts/server/context';

const grantAccessSchema = z.object({
  userIds: z.array(z.string()).optional(),
  groupIds: z.array(z.string()).optional(),
  accessLevel: z.enum(['view', 'edit', 'manage', 'admin']).default('view'),
  expiresAt: z.string().datetime().nullable().optional(),
  notify: z.boolean().default(true),
}).refine((data) => (data.userIds?.length ?? 0) > 0 || (data.groupIds?.length ?? 0) > 0, {
  message: 'userIds or groupIds required',
});

const revokeAccessSchema = z.object({
  userIds: z.array(z.string()).optional(),
  groupIds: z.array(z.string()).optional(),
});

type AccessLevel = 'view' | 'edit' | 'manage' | 'admin';

export async function getContractAccess(
  context: ContractApiContext,
  contractId: string,
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: { id: true, fileName: true },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const userAccess = await prisma.contractUserAccess.findMany({
    where: { contractId },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
      },
    },
  });

  const groupAccess = await prisma.contractGroupAccess.findMany({
    where: { contractId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          color: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  return createSuccessResponse(context, {
    contractId,
    users: userAccess.map((entry) => ({
      id: entry.user.id,
      email: entry.user.email,
      name: `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() || entry.user.email,
      avatar: entry.user.avatar,
      accessLevel: entry.accessLevel,
      grantedAt: entry.grantedAt,
      expiresAt: entry.expiresAt,
    })),
    groups: groupAccess.map((entry) => ({
      id: entry.group.id,
      name: entry.group.name,
      color: entry.group.color,
      memberCount: entry.group._count.members,
      accessLevel: entry.accessLevel,
      grantedAt: entry.grantedAt,
      expiresAt: entry.expiresAt,
    })),
  });
}

export async function postContractAccess(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const canManage = await hasPermission(context.userId, 'contracts:manage') ||
    await hasContractAccess(context.userId, contractId, 'manage');

  if (!canManage) {
    return createErrorResponse(context, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { userIds, groupIds, accessLevel, expiresAt, notify } = grantAccessSchema.parse(await request.json());
  const { contractService } = await import('data-orchestration/services');
  const contractResult = await contractService.getContract(contractId, context.tenantId);

  if (!contractResult.success || !contractResult.data) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const results = { usersGranted: 0, groupsGranted: 0 };

  if (userIds && userIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, tenantId: context.tenantId },
      select: { id: true },
    });

    for (const user of validUsers) {
      await prisma.contractUserAccess.upsert({
        where: {
          contractId_userId: { contractId, userId: user.id },
        },
        create: {
          contractId,
          userId: user.id,
          accessLevel,
          grantedBy: context.userId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        update: {
          accessLevel,
          grantedBy: context.userId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });
    }
    results.usersGranted = validUsers.length;
  }

  if (groupIds && groupIds.length > 0) {
    const validGroups = await prisma.userGroup.findMany({
      where: { id: { in: groupIds }, tenantId: context.tenantId },
      select: { id: true },
    });

    await prisma.$transaction(
      validGroups.map((group) =>
        prisma.contractGroupAccess.upsert({
          where: {
            contractId_groupId: { contractId, groupId: group.id },
          },
          create: {
            contractId,
            groupId: group.id,
            accessLevel,
            grantedBy: context.userId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
          update: {
            accessLevel,
            grantedBy: context.userId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        }),
      ),
    );
    results.groupsGranted = validGroups.length;
  }

  await auditLog({
    action: AuditAction.CONTRACT_ACCESS_GRANTED,
    userId: context.userId,
    tenantId: context.tenantId,
    resourceType: 'contract',
    resourceId: contractId,
    metadata: { userIds, groupIds, accessLevel, expiresAt },
    requestId: request.headers.get('x-request-id') || undefined,
  });

  if (notify && userIds && userIds.length > 0) {
    try {
      const usersToNotify = await prisma.user.findMany({
        where: { id: { in: userIds }, tenantId: context.tenantId },
        select: { id: true, email: true, firstName: true },
      });

      const currentUser = await prisma.user.findUnique({
        where: { id: context.userId },
        select: { firstName: true, lastName: true, email: true },
      });
      const granterName = currentUser?.firstName
        ? `${currentUser.firstName} ${currentUser.lastName || ''}`
        : currentUser?.email || 'Unknown';

      const baseUrl = process.env.NEXT_PUBLIC_URL;
      if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_URL environment variable must be configured');
      }

      await Promise.allSettled(
        usersToNotify.map((user) => {
          const template = emailTemplates.contractAccessGranted({
            recipientName: user.firstName || user.email,
            contractTitle: (contractResult.data as any).title || (contractResult.data as any).contractTitle || 'Untitled Contract',
            accessLevel,
            grantedBy: granterName,
            expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString() : undefined,
            contractUrl: `${baseUrl}/contracts/${contractId}`,
          });

          return sendEmail({
            to: user.email,
            subject: template.subject,
            html: template.html,
          });
        }),
      );
    } catch (notifyError) {
      logger.error('[Contract Access] Notification error:', notifyError);
    }
  }

  return createSuccessResponse(context, { success: true, ...results });
}

export async function deleteContractAccess(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const canManage = await hasPermission(context.userId, 'contracts:manage') ||
    await hasContractAccess(context.userId, contractId, 'manage');

  if (!canManage) {
    return createErrorResponse(context, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { userIds, groupIds } = revokeAccessSchema.parse(await request.json());
  const results = { usersRevoked: 0, groupsRevoked: 0 };

  if (userIds && userIds.length > 0) {
    const result = await prisma.contractUserAccess.deleteMany({
      where: { contractId, userId: { in: userIds } },
    });
    results.usersRevoked = result.count;
  }

  if (groupIds && groupIds.length > 0) {
    const result = await prisma.contractGroupAccess.deleteMany({
      where: { contractId, groupId: { in: groupIds } },
    });
    results.groupsRevoked = result.count;
  }

  await auditLog({
    action: AuditAction.CONTRACT_ACCESS_REVOKED,
    userId: context.userId,
    tenantId: context.tenantId,
    resourceType: 'contract',
    resourceId: contractId,
    metadata: { userIds, groupIds },
    requestId: request.headers.get('x-request-id') || undefined,
  });

  return createSuccessResponse(context, { success: true, ...results });
}

export async function hasContractAccess(
  userId: string,
  contractId: string,
  requiredLevel: AccessLevel,
): Promise<boolean> {
  const levelHierarchy: AccessLevel[] = ['view', 'edit', 'manage', 'admin'];
  const requiredIndex = levelHierarchy.indexOf(requiredLevel);

  const userAccess = await prisma.contractUserAccess.findFirst({
    where: {
      contractId,
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  if (userAccess) {
    const userLevel = levelHierarchy.indexOf(userAccess.accessLevel as AccessLevel);
    if (userLevel >= requiredIndex) return true;
  }

  const userGroups = await prisma.userGroupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });

  const groupIds = userGroups.map((userGroup) => userGroup.groupId);
  if (groupIds.length > 0) {
    const groupAccess = await prisma.contractGroupAccess.findFirst({
      where: {
        contractId,
        groupId: { in: groupIds },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { accessLevel: 'desc' },
    });

    if (groupAccess) {
      const groupLevel = levelHierarchy.indexOf(groupAccess.accessLevel as AccessLevel);
      if (groupLevel >= requiredIndex) return true;
    }
  }

  return false;
}

export async function getUserAccessibleContracts(
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const directAccess = await prisma.contractUserAccess.findMany({
    where: {
      userId,
      contract: { tenantId },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: { contractId: true },
  });

  const userGroups = await prisma.userGroupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });

  const groupIds = userGroups.map((userGroup) => userGroup.groupId);
  let groupAccess: { contractId: string }[] = [];

  if (groupIds.length > 0) {
    groupAccess = await prisma.contractGroupAccess.findMany({
      where: {
        groupId: { in: groupIds },
        contract: { tenantId },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { contractId: true },
    });
  }

  return Array.from(new Set([
    ...directAccess.map((access) => access.contractId),
    ...groupAccess.map((access) => access.contractId),
  ]));
}