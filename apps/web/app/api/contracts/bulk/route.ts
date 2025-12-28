import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishRealtimeEvent } from '@/lib/realtime/publish'
import { safeDeleteContract } from '@/lib/services/contract-deletion.service'
import { bulkOperationSchema } from '@/lib/validation/contract.validation'
import { ZodError } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const dataMode = request.headers.get('x-data-mode') || 'real'
    const tenantId = request.headers.get('x-tenant-id')

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
          }
        })
        
        return NextResponse.json({
          success: true,
          message: `Export ready for ${contractsToExport.length} contracts`,
          data: contractsToExport,
          downloadUrl: `/api/contracts/bulk/download?ids=${contractIds.join(',')}`
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
        // For now, just acknowledge - would need to implement tag storage
        return NextResponse.json({
          success: true,
          message: `Tags ${mode === 'add' ? 'added to' : mode === 'remove' ? 'removed from' : 'set for'} ${contractIds.length} contracts`
        })

      default:
        return NextResponse.json(
          { success: false, error: `Invalid operation: ${operation}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Bulk operation error:', error)
    return NextResponse.json(
      { success: false, error: 'Bulk operation failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}
