import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { withContractApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware'
import { auditLog, AuditAction } from '@/lib/security/audit'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'

const bulkAccessSchema = z.object({
  contractIds: z.array(z.string()).min(1),
  userIds: z.array(z.string()).optional(),
  groupIds: z.array(z.string()).optional(),
  accessLevel: z.enum(['view', 'edit', 'manage', 'admin']).default('view'),
  mode: z.enum(['grant', 'revoke']).default('grant'),
  expiresAt: z.string().datetime().nullable().optional(),
}).refine((data) => (data.userIds?.length ?? 0) > 0 || (data.groupIds?.length ?? 0) > 0, {
  message: 'userIds or groupIds required',
})

export const POST = withContractApiHandler(async (request, ctx) => {
  const body = await request.json()
  const parsed = bulkAccessSchema.safeParse(body)

  if (!parsed.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.message, 400)
  }

  const { contractIds, userIds, groupIds, accessLevel, mode, expiresAt } = parsed.data
  const { tenantId, userId } = ctx

  // Check permission
  const canManage = await hasPermission(userId, 'contracts:manage')
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Insufficient permissions', 403)
  }

  // Verify contracts belong to tenant
  const validContracts = await prisma.contract.findMany({
    where: { id: { in: contractIds }, tenantId },
    select: { id: true },
  })

  if (validContracts.length === 0) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'No valid contracts found', 404)
  }

  const validContractIds = validContracts.map((c) => c.id)
  const expiryDate = expiresAt ? new Date(expiresAt) : null

  let userResults = 0
  let groupResults = 0

  if (mode === 'grant') {
    if (userIds && userIds.length > 0) {
      const validUsers = await prisma.user.findMany({
        where: { id: { in: userIds }, tenantId },
        select: { id: true },
      })

      const ops: Prisma.PrismaPromise<any>[] = []
      for (const contractId of validContractIds) {
        for (const user of validUsers) {
          ops.push(
            prisma.contractUserAccess.upsert({
              where: { contractId_userId: { contractId, userId: user.id } },
              create: {
                contractId,
                userId: user.id,
                accessLevel,
                grantedBy: userId,
                expiresAt: expiryDate,
              },
              update: {
                accessLevel,
                grantedBy: userId,
                expiresAt: expiryDate,
              },
            }),
          )
        }
      }
      await prisma.$transaction(ops)
      userResults = validUsers.length * validContractIds.length
    }

    if (groupIds && groupIds.length > 0) {
      const validGroups = await prisma.userGroup.findMany({
        where: { id: { in: groupIds }, tenantId },
        select: { id: true },
      })

      const groupOps: Prisma.PrismaPromise<any>[] = []
      for (const contractId of validContractIds) {
        for (const group of validGroups) {
          groupOps.push(
            prisma.contractGroupAccess.upsert({
              where: { contractId_groupId: { contractId, groupId: group.id } },
              create: {
                contractId,
                groupId: group.id,
                accessLevel,
                grantedBy: userId,
                expiresAt: expiryDate,
              },
              update: {
                accessLevel,
                grantedBy: userId,
                expiresAt: expiryDate,
              },
            }),
          )
        }
      }
      await prisma.$transaction(groupOps)
      groupResults = validGroups.length * validContractIds.length
    }
  } else {
    // revoke mode
    if (userIds && userIds.length > 0) {
      const result = await prisma.contractUserAccess.deleteMany({
        where: {
          contractId: { in: validContractIds },
          userId: { in: userIds },
        },
      })
      userResults = result.count
    }

    if (groupIds && groupIds.length > 0) {
      const result = await prisma.contractGroupAccess.deleteMany({
        where: {
          contractId: { in: validContractIds },
          groupId: { in: groupIds },
        },
      })
      groupResults = result.count
    }
  }

  await auditLog({
    action: mode === 'grant' ? AuditAction.CONTRACT_ACCESS_GRANTED : AuditAction.CONTRACT_ACCESS_REVOKED,
    userId,
    tenantId,
    resourceType: 'contract',
    metadata: {
      mode,
      contractCount: validContractIds.length,
      userIds,
      groupIds,
      accessLevel,
    },
  })

  return createSuccessResponse(ctx, {
    message: `${mode === 'grant' ? 'Granted' : 'Revoked'} access for ${validContractIds.length} contract(s)`,
    contractCount: validContractIds.length,
    userAccessEntries: userResults,
    groupAccessEntries: groupResults,
    mode,
    accessLevel,
  })
})
