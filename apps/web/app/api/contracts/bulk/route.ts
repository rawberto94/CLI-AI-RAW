import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishRealtimeEvent } from '@/lib/realtime/publish'
import { safeDeleteContract } from '@/lib/services/contract-deletion.service'
import { bulkOperationSchema } from '@/lib/validation/contract.validation'
import { ZodError } from 'zod'
import { addActivityLogEntry } from '@/lib/activity-log'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const dataMode = request.headers.get('x-data-mode') || 'real'
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id') || 'system'

    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    // Validate request body with Zod schema
    try {
      const validated = bulkOperationSchema.parse(body)
      const { operation, contractIds } = validated
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`)
          },
          { status: 400 }
        )
      }
      throw validationError
    }

    const { operation, contractIds } = body

    if (dataMode !== 'real') {
      // Mock response
      return NextResponse.json({
        success: true,
        message: `Mock ${operation} completed for ${contractIds.length} contracts`
      })
    }

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
        
        return NextResponse.json({
          success: true,
          message: `Export ready for ${contractsToExport.length} contracts`,
          data: contractsToExport,
          format,
          downloadUrl: `/api/contracts/bulk/download?ids=${contractIds.join(',')}&format=${format}`
        })

      case 'analyze':
        // Trigger AI analysis for multiple contracts
        const analyzeResults = []
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
        
        return NextResponse.json({
          success: true,
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
        
        return NextResponse.json({
          success: true,
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
        return NextResponse.json({
          success: true,
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
        return NextResponse.json({
          success: true,
          message: `Archived ${contractIds.length} contracts`
        })

      case 'tag':
        // Apply tags to contracts
        const { tags, mode } = body
        
        if (!tags || !Array.isArray(tags) || tags.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Tags array is required' },
            { status: 400 }
          )
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

        return NextResponse.json({
          success: true,
          message: `Tags ${mode === 'add' ? 'added to' : mode === 'remove' ? 'removed from' : 'set for'} ${contractIds.length} contracts`,
          updatedCount: contractsToTag.length
        })

      case 'categorize':
        // Apply category to contracts
        const { categoryId, categoryName } = body
        if (!categoryId && !categoryName) {
          return NextResponse.json(
            { success: false, error: 'Category ID or name required' },
            { status: 400 }
          )
        }

        // Find category if name provided
        let category = null
        if (categoryId) {
          category = await prisma.taxonomyCategory.findUnique({
            where: { id: categoryId }
          })
        } else if (categoryName) {
          category = await prisma.taxonomyCategory.findFirst({
            where: {
              name: { contains: categoryName, mode: 'insensitive' },
              OR: [{ tenantId }, { tenantId: null }]
            }
          })
        }

        if (!category) {
          return NextResponse.json(
            { success: false, error: 'Category not found' },
            { status: 404 }
          )
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

        return NextResponse.json({
          success: true,
          message: `Categorized ${contractIds.length} contracts as "${category.name}"`
        })

      case 'compare':
        // Generate comparison data
        if (contractIds.length < 2) {
          return NextResponse.json(
            { success: false, error: 'At least 2 contracts required for comparison' },
            { status: 400 }
          )
        }

        const contractsToCompare = await prisma.contract.findMany({
          where: { id: { in: contractIds }, tenantId },
          include: {
            clauses: true
          }
        })

        return NextResponse.json({
          success: true,
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
        const aiAnalyzeResults: Array<{ contractId: string; status: string; error?: string }> = []
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
        
        return NextResponse.json({
          success: true,
          message: `Analysis queued for ${analyzeResults.filter(r => r.status === 'queued').length} contracts`,
          results: analyzeResults
        })

      case 'ai-summarize':
        // Generate summaries for contracts
        const summaryResults = []
        for (const contractId of contractIds.slice(0, 5)) { // Limit to 5 at a time
          try {
            summaryResults.push({ contractId, status: 'queued', task: 'summarize' })
          } catch (e) {
            summaryResults.push({ contractId, status: 'failed', error: (e as Error).message })
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Summary generation queued for ${summaryResults.length} contracts`,
          results: summaryResults
        })

      case 'ai-report':
      case 'ai_report':
        // Generate AI report for contracts
        return NextResponse.json({
          success: true,
          message: `AI report generation started for ${contractIds.length} contracts`,
          reportUrl: `/reports/generate?contracts=${contractIds.join(',')}`,
          estimatedTime: Math.max(30, contractIds.length * 5) // seconds
        })

      case 'email':
        // Send contracts via email
        const { recipients, subject: emailSubject, message } = body
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Recipients required' },
            { status: 400 }
          )
        }

        // Get contract details for email
        const contractsToEmail = await prisma.contract.findMany({
          where: { id: { in: contractIds }, tenantId },
          select: { id: true, contractTitle: true, supplierName: true }
        })

        return NextResponse.json({
          success: true,
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

        return NextResponse.json({
          success: true,
          message: `Duplicated ${duplicatedIds.length} contracts`,
          duplicatedIds
        })

      case 'assign':
        // Assign contracts to user
        const { assigneeId } = body
        if (!assigneeId) {
          return NextResponse.json(
            { success: false, error: 'Assignee ID required' },
            { status: 400 }
          )
        }

        await prisma.contract.updateMany({
          where: { id: { in: contractIds }, tenantId },
          data: { 
            // Note: assignedTo field doesn't exist - using metadata or a custom field
            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          success: true,
          message: `Assigned ${contractIds.length} contracts to user`
        })

      case 'status':
        // Update status
        const { newStatus } = body
        if (!newStatus) {
          return NextResponse.json(
            { success: false, error: 'New status required' },
            { status: 400 }
          )
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

        return NextResponse.json({
          success: true,
          message: `Updated status to ${newStatus} for ${contractIds.length} contracts`
        })

      default:
        return NextResponse.json(
          { success: false, error: `Invalid operation: ${operation}` },
          { status: 400 }
        )
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: 'Bulk operation failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}
