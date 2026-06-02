import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withContractApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware'
import { auditLog, AuditAction } from '@/lib/security/audit'
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
  const { tenantId, userId } = ctx

  // Verify all contracts belong to tenant
  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds }, tenantId },
    select: { id: true, tags: true },
  })

  if (contracts.length === 0) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'No valid contracts found', 404)
  }

  const validIds = contracts.map((c) => c.id)
  const normalizedTags = tags.map((t) => t.trim()).filter(Boolean)

  let updatedCount = 0

  await prisma.$transaction(
    contracts.map((contract) => {
      const currentTags = Array.isArray(contract.tags)
        ? contract.tags.filter((t): t is string => typeof t === 'string')
        : []

      let newTags: string[]
      if (mode === 'add') {
        newTags = Array.from(new Set([...currentTags, ...normalizedTags]))
      } else if (mode === 'remove') {
        newTags = currentTags.filter((t) => !normalizedTags.includes(t))
      } else {
        newTags = normalizedTags
      }

      updatedCount++
      return prisma.contract.update({
        where: { id: contract.id },
        data: { tags: newTags, updatedAt: new Date() },
      })
    }),
  )

  // Also sync to ContractMetadata.tags for consistency
  const metadataRecords = await prisma.contractMetadata.findMany({
    where: { contractId: { in: validIds } },
    select: { contractId: true, tags: true },
  })

  const metadataMap = new Map(metadataRecords.map((m) => [m.contractId, m.tags]))

  await prisma.$transaction(
    validIds.map((id) => {
      const currentMetaTags = metadataMap.get(id) || []
      let newMetaTags: string[]
      if (mode === 'add') {
        newMetaTags = Array.from(new Set([...currentMetaTags, ...normalizedTags]))
      } else if (mode === 'remove') {
        newMetaTags = currentMetaTags.filter((t) => !normalizedTags.includes(t))
      } else {
        newMetaTags = normalizedTags
      }

      return prisma.contractMetadata.upsert({
        where: { contractId: id },
        create: {
          contractId: id,
          tenantId,
          tags: newMetaTags,
          updatedBy: userId,
        },
        update: {
          tags: newMetaTags,
          updatedBy: userId,
          lastUpdated: new Date(),
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

  return createSuccessResponse(ctx, {
    message: `Updated tags for ${updatedCount} contract(s)`,
    updatedCount,
    mode,
    tags: normalizedTags,
  })
})
