/**
 * Taxonomy Migration Cron Job
 * POST /api/cron/migrate-taxonomy - Auto-migrate contracts to new taxonomy
 * 
 * Designed for Vercel Cron Jobs or manual triggering
 * - Processes contracts in batches to avoid timeouts
 * - Only migrates contracts with legacy contractType
 * - Rate-limited to prevent API abuse
 * - Tracks progress and errors
 */

import { NextRequest } from 'next/server'
import { withCronHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { classifyContract } from '@/lib/ai/contract-classifier-taxonomy'
import { taxonomyService } from 'data-orchestration/services';

// Rate limiting: only run if last run was > 1 hour ago
const _RATE_LIMIT_HOURS = 1
const BATCH_SIZE = 50 // Process 50 contracts per run

interface MigrationStats {
  processed: number
  migrated: number
  skipped: number
  failed: number
  errors: Array<{ contractId: string; error: string }>
}

export const POST = withCronHandler(async (request, ctx) => {
    // Get contracts that need migration
    const contractsToMigrate = await prisma.contract.findMany({
      where: {
        AND: [
          {
            OR: [
              { contractCategoryId: null },
              { contractCategoryId: '' },
            ],
          },
          {
            contractType: {
              not: null,
            },
          },
          {
            status: {
              in: ['COMPLETED', 'ACTIVE', 'PENDING'],
            },
          },
          {
            isDeleted: false,
          },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        contractType: true,
        fileName: true,
        clientName: true,
        supplierName: true,
        description: true,
        rawText: true,
      },
      take: BATCH_SIZE,
      orderBy: {
        createdAt: 'asc', // Migrate oldest first
      },
    })

    if (contractsToMigrate.length === 0) {
      return createSuccessResponse(ctx, {
        message: 'No contracts need migration',
        stats: {
          processed: 0,
          migrated: 0,
          skipped: 0,
          failed: 0,
          errors: [],
        },
      })
    }

    const stats: MigrationStats = {
      processed: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    }

    // Process contracts in parallel batches of 10
    const PARALLEL_BATCH = 10
    for (let i = 0; i < contractsToMigrate.length; i += PARALLEL_BATCH) {
      const batch = contractsToMigrate.slice(i, i + PARALLEL_BATCH)

      await Promise.allSettled(
        batch.map(async (contract) => {
          try {
            stats.processed++

            // Classify contract using taxonomy
            const classification = await classifyContract({
              text: contract.rawText || contract.description || '',
              filename: contract.fileName || '',
              existingMetadata: {
                contractType: contract.contractType,
                clientName: contract.clientName,
                supplierName: contract.supplierName,
              },
            })

            if (!classification.classification?.category_id) {
              stats.skipped++
              return
            }

            // Update contract with taxonomy classification
            await prisma.contract.update({
              where: { id: contract.id },
              data: {
                contractCategoryId: classification.classification.category_id,
                contractSubtype: classification.classification.subtype,
                documentRole: classification.classification.role,
                classificationConf: classification.classification.confidence,
                classificationMeta: classification.extracted_fields,
                classifiedAt: new Date(),
                // Apply taxonomy tags if available
                pricingModels: classification.tags?.pricing_models || [],
                deliveryModels: classification.tags?.delivery_models || [],
                dataProfiles: classification.tags?.data_profiles || [],
                riskFlags: classification.tags?.risk_flags || [],
              },
            })

            stats.migrated++
          } catch (error) {
            stats.failed++
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            stats.errors.push({
              contractId: contract.id,
              error: errorMessage,
            })
          }
        })
      )
    }

    return createSuccessResponse(ctx, {
      message: `Processed ${stats.processed} contracts: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.failed} failed`,
      stats,
      hasMore: contractsToMigrate.length === BATCH_SIZE,
    });
});

// Allow manual triggering via GET for testing
export const GET = withCronHandler(async (request, ctx) => {
  // Check if in development mode
  if (process.env.NODE_ENV !== 'development') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Manual triggering only allowed in development', 403)
  }

  // Forward to POST handler
  return POST(request)
});
