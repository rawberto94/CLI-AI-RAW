/**
 * RAG Re-indexing Trigger API
 * 
 * POST /api/rag/reindex - Trigger re-indexing for contracts
 * 
 * This endpoint allows triggering RAG re-indexing when:
 * - Contract rawText has been updated
 * - Embeddings are stale or missing
 * - Manual refresh is requested
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processContractWithSemanticChunking } from '@/lib/rag/advanced-rag.service';

/**
 * POST /api/rag/reindex
 * Trigger re-indexing for specific contracts or stale embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const {
      contractIds,           // Specific contracts to reindex
      staleThresholdHours,   // Reindex if embeddings older than X hours
      forceAll,              // Force reindex all contracts
      limit = 50,            // Max contracts to process
      onlyMissing = false,   // Only process contracts without embeddings
    } = body;

    console.log(`🔄 RAG Reindex triggered for tenant: ${tenantId}`);

    const results: Array<{ contractId: string; status: 'success' | 'skipped' | 'error'; message?: string }> = [];
    const whereClause: any = { tenantId, isDeleted: false };

    // Build query based on options
    if (contractIds && contractIds.length > 0) {
      whereClause.id = { in: contractIds };
    }

    // Get contracts
    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        fileName: true,
        rawText: true,
        rawTextHash: true, // If we track text hash
        updatedAt: true,
        embeddings: {
          select: {
            id: true,
            createdAt: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    // Filter contracts that need reindexing
    const now = new Date();
    const staleThreshold = staleThresholdHours ? staleThresholdHours * 60 * 60 * 1000 : null;

    const contractsToProcess = contracts.filter(contract => {
      // Skip if no text
      if (!contract.rawText || contract.rawText.length < 100) {
        return false;
      }

      // If onlyMissing, skip if has embeddings
      if (onlyMissing && contract.embeddings.length > 0) {
        return false;
      }

      // If forceAll, include all with text
      if (forceAll) {
        return true;
      }

      // Check if embeddings are stale
      if (staleThreshold && contract.embeddings.length > 0) {
        const embeddingAge = now.getTime() - new Date(contract.embeddings[0].createdAt).getTime();
        if (embeddingAge > staleThreshold) {
          return true;
        }
      }

      // Check if contract updated after embeddings
      if (contract.embeddings.length > 0) {
        const contractUpdated = new Date(contract.updatedAt);
        const embeddingCreated = new Date(contract.embeddings[0].createdAt);
        if (contractUpdated > embeddingCreated) {
          return true;
        }
      }

      // No embeddings - needs processing
      if (contract.embeddings.length === 0) {
        return true;
      }

      return false;
    });

    if (contractsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contracts need reindexing',
        processed: 0,
        skipped: contracts.length,
      });
    }

    // Process contracts
    let processed = 0;
    let failed = 0;

    for (const contract of contractsToProcess) {
      try {
        // Delete existing embeddings
        await prisma.embedding.deleteMany({
          where: { contractId: contract.id },
        });

        // Process with semantic chunking
        const result = await processContractWithSemanticChunking(
          contract.id,
          contract.rawText || '',
          { tenantId }
        );

        if (result.success) {
          results.push({ contractId: contract.id, status: 'success' });
          processed++;
        } else {
          results.push({ contractId: contract.id, status: 'error', message: result.error || 'Processing failed' });
          failed++;
        }
      } catch (error) {
        console.error(`Error reindexing contract ${contract.id}:`, error);
        results.push({
          contractId: contract.id,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reindexed ${processed} contracts`,
      processed,
      failed,
      skipped: contracts.length - contractsToProcess.length,
      results,
    });
  } catch (error) {
    console.error('Error in RAG reindex:', error);
    return NextResponse.json(
      { error: 'Reindex failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rag/reindex
 * Check which contracts need reindexing
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get contracts with their embedding status
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        rawText: { not: null },
      },
      select: {
        id: true,
        fileName: true,
        updatedAt: true,
        _count: { select: { embeddings: true } },
        embeddings: {
          select: { createdAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      take: limit,
    });

    // Categorize contracts
    const stats = {
      total: contracts.length,
      indexed: 0,
      needsIndexing: 0,
      stale: 0,
    };

    const needsReindexing: Array<{
      contractId: string;
      fileName: string;
      reason: 'missing' | 'stale' | 'updated';
    }> = [];

    for (const contract of contracts) {
      if (contract._count.embeddings === 0) {
        stats.needsIndexing++;
        needsReindexing.push({
          contractId: contract.id,
          fileName: contract.fileName || 'Unknown',
          reason: 'missing',
        });
      } else if (contract.embeddings.length > 0) {
        const embeddingDate = new Date(contract.embeddings[0].createdAt);
        const contractDate = new Date(contract.updatedAt);
        
        if (contractDate > embeddingDate) {
          stats.stale++;
          needsReindexing.push({
            contractId: contract.id,
            fileName: contract.fileName || 'Unknown',
            reason: 'updated',
          });
        } else {
          stats.indexed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      needsReindexing: needsReindexing.slice(0, 50),
      hasMore: needsReindexing.length > 50,
    });
  } catch (error) {
    console.error('Error checking reindex status:', error);
    return NextResponse.json(
      { error: 'Failed to check reindex status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
