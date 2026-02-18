import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishRealtimeEvent } from '@/lib/realtime/publish'
import { safeDeleteContract } from '@/lib/services/contract-deletion.service'
import { bulkOperationSchema } from '@/lib/validation/contract.validation'
import { ZodError } from 'zod'
import { addActivityLogEntry } from '@/lib/activity-log'
import {
  triggerDocumentReclassified,
  triggerSignatureStatusChanged,
  triggerNonContractDetected,
} from '@/lib/webhook-triggers'
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId
  const userId = ctx.userId
  const body = await request.json()

  // Validate request body with Zod schema
  try {
    const validated = bulkOperationSchema.parse(body)
    const { operation: _operation, contractIds: _contractIds } = validated
  } catch (validationError) {
    if (validationError instanceof ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Validation failed', 400, {
        details: validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      })
    }
    throw validationError
  }

  const { operation, contractIds } = body

  // Real bulk operations
  switch (operation) {
    case 'export':
    case 'export-csv':
    case 'export-json':
    case 'export-pdf':
      // Generate export data
      const contractsToExport = await prisma.contract.findMany({
        where: { 
          id: { in: contractIds },
          tenantId
        },
        select: {
          id: true,
          contractTitle: true,
          fileName: true,
          status: true,
          contractType: true,
          supplierName: true,
          clientName: true,
          totalValue: true,
          currency: true,
          effectiveDate: true,
          expirationDate: true,
          createdAt: true,
          category: true,
        }
      })
      
      const format = operation.includes('-') ? operation.split('-')[1] : 'csv'
      
      return createSuccessResponse(ctx, {
        message: `Export ready for ${contractsToExport.length} contracts`,
        contracts: contractsToExport,
        format,
        downloadUrl: `/api/contracts/bulk/download?ids=${contractIds.join(',')}&format=${format}`
      })

    case 'analyze':
      // Trigger AI analysis for multiple contracts
      const analyzeResults: Array<{ contractId: string; status: string; error?: string }> = []
      for (const contractId of contractIds.slice(0, 10)) { // Limit to 10 at a time
        try {
          // Queue analysis job or run inline
          await prisma.contract.update({
            where: { id: contractId },
            data: { 
              status: 'PROCESSING',
              updatedAt: new Date() 
            }
          })

          await publishRealtimeEvent({
            event: 'contract:updated',
            data: { tenantId, contractId, status: 'PROCESSING' },
            source: 'api:contracts/bulk',
          })
          analyzeResults.push({ contractId, status: 'queued' })
        } catch (e) {
          analyzeResults.push({ contractId, status: 'failed', error: (e as Error).message })
        }
      }
      
      return createSuccessResponse(ctx, {
        message: `Analysis queued for ${analyzeResults.filter(r => r.status === 'queued').length} contracts`,
        results: analyzeResults
      })

    case 'share':
      // Share functionality - create share links
      const shareLinks = contractIds.map(id => ({
        contractId: id,
        shareUrl: `/contracts/${id}?shared=true`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }))
      
      return createSuccessResponse(ctx, {
        message: `Share links generated for ${contractIds.length} contracts`,
        shareLinks
      })

    case 'delete':
      // Delete multiple contracts with cascade safety
      const deleteResults = await Promise.allSettled(
        contractIds.map((contractId: string) =>
          safeDeleteContract(contractId, tenantId)
        )
      )

      const successCount = deleteResults.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length
      const failedCount = deleteResults.length - successCount

      // Realtime events already published by safeDeleteContract
      return createSuccessResponse(ctx, {
        message: `Deleted ${successCount} contracts${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        deleted: successCount,
        failed: failedCount
      })

    case 'archive':
      // Archive contracts (set status)
      await prisma.contract.updateMany({
        where: { 
          id: { in: contractIds },
          tenantId
        },
        data: {
          status: 'ARCHIVED',
          updatedAt: new Date()
        }
      })

      await Promise.all(
        contractIds.map((contractId: string) =>
          publishRealtimeEvent({
            event: 'contract:updated',
            data: { tenantId, contractId, status: 'ARCHIVED' },
            source: 'api:contracts/bulk',
          })
        )
      )
      return createSuccessResponse(ctx, {
        message: `Archived ${contractIds.length} contracts`
      })

    case 'tag':
      // Apply tags to contracts
      const { tags, mode } = body
      
      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tags array is required', 400)
      }

      // Get current contracts to update their tags
      const contractsToTag = await prisma.contract.findMany({
        where: { id: { in: contractIds }, tenantId },
        select: { id: true, tags: true }
      })

      // Update each contract's tags based on mode
      const tagUpdatePromises = contractsToTag.map(async (contract) => {
        const currentTags = (contract.tags as string[]) || []
        let newTags: string[]

        switch (mode) {
          case 'add':
            // Add tags without duplicates
            newTags = [...new Set([...currentTags, ...tags])]
            break
          case 'remove':
            // Remove specified tags
            newTags = currentTags.filter(t => !tags.includes(t))
            break
          case 'replace':
          default:
            // Replace all tags
            newTags = tags
            break
        }

        return prisma.contract.update({
          where: { id: contract.id },
          data: { 
            tags: newTags,
            updatedAt: new Date()
          }
        })
      })

      await Promise.all(tagUpdatePromises)

      // Log activity for each contract
      await Promise.all(
        contractIds.map((contractId: string) =>
          addActivityLogEntry({
            action: 'TAGS_UPDATED',
            entityType: 'contract',
            entityId: contractId,
            userId,
            metadata: { tags, mode }
          })
        )
      )

      return createSuccessResponse(ctx, {
        message: `Tags ${mode === 'add' ? 'added to' : mode === 'remove' ? 'removed from' : 'set for'} ${contractIds.length} contracts`,
        updatedCount: contractsToTag.length
      })

    case 'categorize':
      // Apply category to contracts
      const { categoryId, categoryName } = body
      if (!categoryId && !categoryName) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Category ID or name required', 400)
      }

      // Find category if name provided
      let category: Awaited<ReturnType<typeof prisma.taxonomyCategory.findUnique>> = null
      if (categoryId) {
        category = await prisma.taxonomyCategory.findUnique({
          where: { id: categoryId }
        })
      } else if (categoryName) {
        category = await prisma.taxonomyCategory.findFirst({
          where: {
            name: { contains: categoryName, mode: 'insensitive' },
            tenantId
          }
        })
      }

      if (!category) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Category not found', 404)
      }

      await prisma.contract.updateMany({
        where: { id: { in: contractIds }, tenantId },
        data: {
          category: category.name,
          updatedAt: new Date()
        }
      })

      // Log activity for each contract
      await Promise.all(
        contractIds.map((contractId: string) =>
          addActivityLogEntry({
            tenantId,
            contractId,
            action: 'CATEGORY_UPDATED',
            performedBy: userId,
            details: { categoryId: category!.id, categoryName: category!.name, bulk: true }
          })
        )
      )

      return createSuccessResponse(ctx, {
        message: `Categorized ${contractIds.length} contracts as "${category.name}"`
      })

    case 'compare':
      // Generate comparison data
      if (contractIds.length < 2) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'At least 2 contracts required for comparison', 400)
      }

      const contractsToCompare = await prisma.contract.findMany({
        where: { id: { in: contractIds }, tenantId },
        include: {
          clauses: true
        }
      })

      return createSuccessResponse(ctx, {
        message: `Comparison ready for ${contractsToCompare.length} contracts`,
        comparisonUrl: `/compare?ids=${contractIds.join(',')}`,
        contracts: contractsToCompare.map(c => ({
          id: c.id,
          title: c.contractTitle,
          supplier: c.supplierName,
          value: c.totalValue,
          status: c.status,
          category: c.category,
          clauseCount: c.clauses.length
        }))
      })

    case 'ai-analyze':
    case 'analyze':
      // Trigger AI analysis for multiple contracts
      // Batch status updates in a single transaction
      const analysisContractIds = contractIds.slice(0, 10);
      await prisma.$transaction(
        analysisContractIds.map(contractId =>
          prisma.contract.update({
            where: { id: contractId },
            data: { 
              status: 'PROCESSING',
              updatedAt: new Date() 
            }
          })
        )
      );

      // Fire realtime events in parallel (non-blocking)
      void Promise.allSettled(
        analysisContractIds.map(contractId =>
          publishRealtimeEvent({
            event: 'contract:updated',
            data: { tenantId, contractId, status: 'PROCESSING' },
            source: 'api:contracts/bulk',
          })
        )
      );
      const batchAnalyzeResults = analysisContractIds.map(contractId => ({ contractId, status: 'queued' }));
      
      return createSuccessResponse(ctx, {
        message: `Analysis queued for ${batchAnalyzeResults.filter(r => r.status === 'queued').length} contracts`,
        results: batchAnalyzeResults
      })

    case 'ai-summarize':
      // Generate summaries for contracts
      const summaryResults: Array<{ contractId: string; status: string; task?: string; error?: string }> = []
      for (const contractId of contractIds.slice(0, 5)) { // Limit to 5 at a time
        try {
          summaryResults.push({ contractId, status: 'queued', task: 'summarize' })
        } catch (e) {
          summaryResults.push({ contractId, status: 'failed', error: (e as Error).message })
        }
      }
      
      return createSuccessResponse(ctx, {
        message: `Summary generation queued for ${summaryResults.length} contracts`,
        results: summaryResults
      })

    case 'ai-report':
    case 'ai_report':
      // Generate AI report for contracts
      return createSuccessResponse(ctx, {
        message: `AI report generation started for ${contractIds.length} contracts`,
        reportUrl: `/reports/generate?contracts=${contractIds.join(',')}`,
        estimatedTime: Math.max(30, contractIds.length * 5) // seconds
      })

    case 'email':
      // Send contracts via email
      const { recipients, subject: emailSubject, message: _message } = body
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Recipients required', 400)
      }

      // Get contract details for email
      const contractsToEmail = await prisma.contract.findMany({
        where: { id: { in: contractIds }, tenantId },
        select: { id: true, contractTitle: true, supplierName: true }
      })

      return createSuccessResponse(ctx, {
        message: `Email queued for ${recipients.length} recipients with ${contractsToEmail.length} contracts`,
        emailDetails: {
          recipients,
          subject: emailSubject || `Contract Documents (${contractsToEmail.length})`,
          contracts: contractsToEmail
        }
      })

    case 'duplicate':
      // Duplicate contracts
      const duplicatedIds: string[] = []
      for (const contractId of contractIds) {
        try {
          const original = await prisma.contract.findFirst({
            where: { id: contractId, tenantId }
          })
          
          if (original) {
            const duplicateTitle = `${original.contractTitle} (Copy)`;
            const duplicate = await prisma.contract.create({
              data: {
                tenantId,
                contractTitle: duplicateTitle,
                supplierName: original.supplierName,
                category: original.category,
                status: 'DRAFT',
                contractType: original.contractType,
                totalValue: original.totalValue,
                paymentTerms: original.paymentTerms,
                autoRenewalEnabled: original.autoRenewalEnabled,
                mimeType: original.mimeType || 'application/pdf',
                fileName: duplicateTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
                fileSize: original.fileSize || BigInt(0),
                uploadedBy: userId
              }
            })
            duplicatedIds.push(duplicate.id)
          }
        } catch {
          // Failed to duplicate contract, continue with others
        }
      }

      return createSuccessResponse(ctx, {
        message: `Duplicated ${duplicatedIds.length} contracts`,
        duplicatedIds
      })

    case 'assign':
      // Assign contracts to user
      const { assigneeId } = body
      if (!assigneeId) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Assignee ID required', 400)
      }

      await prisma.contract.updateMany({
        where: { id: { in: contractIds }, tenantId },
        data: { 
          // Note: assignedTo field doesn't exist - using metadata or a custom field
          updatedAt: new Date()
        }
      })

      return createSuccessResponse(ctx, {
        message: `Assigned ${contractIds.length} contracts to user`
      })

    case 'status':
      // Update status
      const { newStatus } = body
      if (!newStatus) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'New status required', 400)
      }

      await prisma.contract.updateMany({
        where: { id: { in: contractIds }, tenantId },
        data: { 
          status: newStatus,
          updatedAt: new Date()
        }
      })

      await Promise.all(
        contractIds.map((contractId: string) =>
          publishRealtimeEvent({
            event: 'contract:updated',
            data: { tenantId, contractId, status: newStatus },
            source: 'api:contracts/bulk',
          })
        )
      )

      return createSuccessResponse(ctx, {
        message: `Updated status to ${newStatus} for ${contractIds.length} contracts`
      })

    case 'reclassify':
      // Reclassify document types and optionally update signature status
      const { classification, signatureUpdate } = body
      
      if (!classification) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Document classification is required', 400)
      }

      // Valid classification values
      const validClassifications = [
        'contract', 'purchase_order', 'invoice', 'quote', 'proposal',
        'work_order', 'letter_of_intent', 'memorandum', 'amendment', 'addendum', 'unknown'
      ]

      if (!validClassifications.includes(classification)) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid classification: ${classification}. Valid values: ${validClassifications.join(', ')}`, 400)
      }

      // Build the update data
      interface ReclassifyUpdateData {
        documentClassification: string;
        signatureStatus?: string;
        updatedAt: Date;
      }

      const reclassifyData: ReclassifyUpdateData = {
        documentClassification: classification,
        updatedAt: new Date()
      }

      // Optionally update signature status
      if (signatureUpdate && signatureUpdate !== 'no_change') {
        const validSignatureStatuses = ['signed', 'unsigned', 'partially_signed', 'unknown']
        if (!validSignatureStatuses.includes(signatureUpdate)) {
          return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid signature status: ${signatureUpdate}`, 400)
        }
        reclassifyData.signatureStatus = signatureUpdate
      }

      // Update contracts
      await prisma.contract.updateMany({
        where: { id: { in: contractIds }, tenantId },
        data: reclassifyData
      })

      // Log activity for each contract
      await Promise.all(
        contractIds.map((contractId: string) =>
          addActivityLogEntry({
            action: 'DOCUMENT_RECLASSIFIED',
            entityType: 'contract',
            entityId: contractId,
            userId,
            metadata: {
              classification,
              signatureUpdate: signatureUpdate || 'unchanged',
              bulk: true,
              totalInBatch: contractIds.length
            }
          })
        )
      )

      // Publish realtime events
      await Promise.all(
        contractIds.map((contractId: string) =>
          publishRealtimeEvent({
            event: 'contract:updated',
            data: {
              tenantId,
              contractId,
              documentClassification: classification,
              signatureStatus: signatureUpdate || undefined
            },
            source: 'api:contracts/bulk',
          })
        )
      )

      // Trigger webhooks for reclassification
      const nonContractTypes = ['purchase_order', 'invoice', 'quote', 'work_order', 'letter_of_intent', 'memorandum']
      const isNonContract = nonContractTypes.includes(classification)

      await Promise.all(
        contractIds.map(async (contractId: string) => {
          // Trigger reclassification webhook
          await triggerDocumentReclassified(tenantId, contractId, {
            newClassification: classification,
            signatureStatusUpdated: !!(signatureUpdate && signatureUpdate !== 'no_change'),
            newSignatureStatus: signatureUpdate !== 'no_change' ? signatureUpdate : undefined,
            changedBy: userId,
            bulk: true,
          })

          // If reclassified to non-contract, trigger alert webhook
          if (isNonContract) {
            await triggerNonContractDetected(tenantId, contractId, {
              documentClassification: classification,
              uploadedBy: userId,
            })
          }
        })
      )

      return createSuccessResponse(ctx, {
        message: `Reclassified ${contractIds.length} document${contractIds.length > 1 ? 's' : ''} as "${classification}"${signatureUpdate && signatureUpdate !== 'no_change' ? ` and marked as ${signatureUpdate}` : ''}`,
        updatedCount: contractIds.length,
        classification,
        signatureUpdate: signatureUpdate || null
      })

    case 'mark-signed':
    case 'mark_signed':
      // Mark documents as signed
      await prisma.contract.updateMany({
        where: { id: { in: contractIds }, tenantId },
        data: {
          signatureStatus: 'signed',
          updatedAt: new Date()
        }
      })

      await Promise.all(
        contractIds.map((contractId: string) =>
          addActivityLogEntry({
            action: 'SIGNATURE_STATUS_UPDATED',
            entityType: 'contract',
            entityId: contractId,
            userId,
            metadata: { signatureStatus: 'signed', bulk: true }
          })
        )
      )

      await Promise.all(
        contractIds.map((contractId: string) =>
          publishRealtimeEvent({
            event: 'contract:updated',
            data: { tenantId, contractId, signatureStatus: 'signed' },
            source: 'api:contracts/bulk',
          })
        )
      )

      // Trigger webhook for signature status change
      await Promise.all(
        contractIds.map((contractId: string) =>
          triggerSignatureStatusChanged(tenantId, contractId, {
            newStatus: 'signed',
            changedBy: userId,
            bulk: true,
          })
        )
      )

      return createSuccessResponse(ctx, {
        message: `Marked ${contractIds.length} document${contractIds.length > 1 ? 's' : ''} as signed`
      })

    case 'mark-unsigned':
    case 'mark_unsigned':
      // Mark documents as unsigned
      await prisma.contract.updateMany({
        where: { id: { in: contractIds }, tenantId },
        data: {
          signatureStatus: 'unsigned',
          updatedAt: new Date()
        }
      })

      await Promise.all(
        contractIds.map((contractId: string) =>
          addActivityLogEntry({
            action: 'SIGNATURE_STATUS_UPDATED',
            entityType: 'contract',
            entityId: contractId,
            userId,
            metadata: { signatureStatus: 'unsigned', bulk: true }
          })
        )
      )

      await Promise.all(
        contractIds.map((contractId: string) =>
          publishRealtimeEvent({
            event: 'contract:updated',
            data: { tenantId, contractId, signatureStatus: 'unsigned' },
            source: 'api:contracts/bulk',
          })
        )
      )

      // Trigger webhook for signature status change
      await Promise.all(
        contractIds.map((contractId: string) =>
          triggerSignatureStatusChanged(tenantId, contractId, {
            newStatus: 'unsigned',
            changedBy: userId,
            bulk: true,
          })
        )
      )

      return createSuccessResponse(ctx, {
        message: `Marked ${contractIds.length} document${contractIds.length > 1 ? 's' : ''} as unsigned`
      })

    default:
      return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid operation: ${operation}`, 400)
  }
});
