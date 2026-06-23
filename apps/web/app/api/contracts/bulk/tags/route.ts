import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withContractApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware'
import { auditLog, AuditAction } from '@/lib/security/audit'
import { checkContractWritePermission } from '@/lib/security/contract-acl'
import { applyContractChangeSideEffects } from '@/lib/contracts/server/contract-change-side-effects'
import { z } from 'zod'

const bulkTagsSchema = z.object({
  contractIds: z.array(z.string()).min(1),
  tags: z.array(z.string()).min(1),
  mode: z.enum(['add', 'remove', 'set']).default('add'),
})

export const POST = withContractApiHandler(async (request, ctx) => {
  const body = await request.json()
  const parsed = bulkTagsSchema.safeParse(body)

  if (!parsed.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.message, 400)
  }

  const { contractIds, tags, mode } = parsed.data
  const { tenantId, userId, userRole } = ctx

  // Verify all contracts belong to tenant and the caller can edit them
  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds }, tenantId },
    select: { id: true },
  })

  if (contracts.length === 0) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'No valid contracts found', 404)
  }

  const allowedContracts: typeof contracts = []
  for (const contract of contracts) {
    const aclDecision = await checkContractWritePermission({
      contractId: contract.id,
      tenantId,
      userId,
      userRole,
      required: 'EDIT',
    })
    if (aclDecision.allowed) {
      allowedContracts.push(contract)
    }
  }

  if (allowedContracts.length === 0) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'You do not have permission to edit tags on these contracts', 403)
  }

  const validIds = allowedContracts.map((c) => c.id)
  const normalizedTags = tags.map((t) => t.trim()).filter(Boolean)
  const forbiddenCount = contracts.length - allowedContracts.length

  let updatedCount = 0

  const metadataRecords = await prisma.contractMetadata.findMany({
    where: { contractId: { in: validIds } },
    select: { contractId: true, tags: true },
  })

  const metadataMap = new Map(metadataRecords.map((m) => [m.contractId, m.tags]))

  await prisma.$transaction(
    validIds.map((contractId) => {
      const currentTags = metadataMap.get(contractId) || []

      let newTags: string[]
      if (mode === 'add') {
        newTags = Array.from(new Set([...currentTags, ...normalizedTags]))
      } else if (mode === 'remove') {
        newTags = currentTags.filter((t) => !normalizedTags.includes(t))
      } else {
        newTags = normalizedTags
      }

      updatedCount++

      return prisma.contractMetadata.upsert({
        where: { contractId },
        create: {
          contractId,
          tenantId,
          tags: newTags,
          updatedBy: userId,
        },
        update: {
          tags: newTags,
          updatedBy: userId,
          lastUpdated: new Date(),
        },
      })
    }),
  )

  const updatedMetadataRecords = await prisma.contractMetadata.findMany({
    where: { contractId: { in: validIds } },
    select: { contractId: true, tags: true },
  })
  const updatedTagMap = new Map(updatedMetadataRecords.map((m) => [m.contractId, m.tags]))

  const contractsForAi = await prisma.contract.findMany({
    where: { id: { in: validIds } },
    select: { id: true, aiMetadata: true },
  })
  const aiMetadataMap = new Map(contractsForAi.map((c) => [c.id, (c.aiMetadata as Record<string, unknown>) || {}]))

  await prisma.$transaction(
    validIds.map((id) => {
      const syncedTags = updatedTagMap.get(id) || []
      return prisma.contract.update({
        where: { id },
        data: {
          tags: syncedTags,
          aiMetadata: {
            ...(aiMetadataMap.get(id) || {}),
            tags: syncedTags,
          },
          updatedAt: new Date(),
        },
      })
    }),
  )

  await auditLog({
    action: AuditAction.CONTRACT_UPDATED,
    userId,
    tenantId,
    resourceType: 'contract',
    metadata: { operation: 'bulk_tags', mode, contractIds: validIds, tags: normalizedTags },
  })

  // Propagate changes to caches, real-time consumers, webhooks, and RAG.
  for (const id of validIds) {
    applyContractChangeSideEffects({
      tenantId,
      contractId: id,
      userId,
      changedFields: ['tags'],
      source: 'api:contracts/bulk/tags',
    }).catch(() => {})
  }

  return createSuccessResponse(ctx, {
    message: `Updated tags for ${updatedCount} contract(s)`,
    updatedCount,
    forbiddenCount,
    mode,
    tags: normalizedTags,
  })
})
