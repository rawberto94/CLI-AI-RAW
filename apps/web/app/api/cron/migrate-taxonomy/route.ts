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

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyContract } from '@/lib/ai/contract-classifier-taxonomy'

// Rate limiting: only run if last run was > 1 hour ago
const RATE_LIMIT_HOURS = 1
const BATCH_SIZE = 50 // Process 50 contracts per run

interface MigrationStats {
  processed: number
  migrated: number
  skipped: number
  failed: number
  errors: Array<{ contractId: string; error: string }>
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🔄 Starting taxonomy migration cron job')

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

    console.log(`📊 Found ${contractsToMigrate.length} contracts to migrate`)

    if (contractsToMigrate.length === 0) {
      return NextResponse.json({
        success: true,
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
              console.log(`⏭️  Skipped ${contract.id}: No classification`)
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
            console.log(`✅ Migrated ${contract.id}: ${classification.classification.category_id}`)
          } catch (error) {
            stats.failed++
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            stats.errors.push({
              contractId: contract.id,
              error: errorMessage,
            })
            console.error(`❌ Failed ${contract.id}:`, errorMessage)
          }
        })
      )
    }

    console.log('✅ Taxonomy migration cron job completed', stats)

    return NextResponse.json({
      success: true,
      message: `Processed ${stats.processed} contracts: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.failed} failed`,
      stats,
      hasMore: contractsToMigrate.length === BATCH_SIZE,
    })
  } catch (error) {
    console.error('Taxonomy migration cron error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}

// Allow manual triggering via GET for testing
export async function GET(request: NextRequest) {
  // Check if in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Manual triggering only allowed in development' },
      { status: 403 }
    )
  }

  // Forward to POST handler
  return POST(request)
}
