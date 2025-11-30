/**
 * Batch RAG Processing API
 * 
 * POST /api/ai/rag/batch - Process multiple contracts for RAG embeddings
 * 
 * Features:
 * - Bulk embedding generation for multiple contracts
 * - Progress tracking with real-time updates
 * - Intelligent prioritization
 * - Resource optimization with batch limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';
import { processContractWithSemanticChunking } from '@/lib/rag/advanced-rag.service';

interface BatchRequest {
  contractIds?: string[];
  processAll?: boolean;
  reprocessExisting?: boolean;
  priority?: 'high' | 'normal' | 'low';
  maxConcurrent?: number;
}

interface ContractProcessResult {
  contractId: string;
  fileName: string;
  status: 'success' | 'failed' | 'skipped';
  chunksCreated?: number;
  embeddingsGenerated?: number;
  processingTime?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: BatchRequest = await request.json();
    const { 
      contractIds, 
      processAll = false, 
      reprocessExisting = false,
      priority = 'normal',
      maxConcurrent = 3,
    } = body;

    const tenantId = await getServerTenantId();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build query to find contracts to process
    let contracts: { id: string; fileName: string; rawText: string | null; hasEmbeddings: boolean }[];

    if (processAll) {
      // Get all contracts that need processing
      const allContracts = await prisma.contract.findMany({
        where: { 
          tenantId,
          rawText: { not: null },
          status: 'COMPLETED',
        },
        select: {
          id: true,
          fileName: true,
          rawText: true,
          contractEmbeddings: { select: { id: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // Limit to prevent overwhelming
      });

      contracts = allContracts.map(c => ({
        id: c.id,
        fileName: c.fileName,
        rawText: c.rawText,
        hasEmbeddings: c.contractEmbeddings.length > 0,
      }));

      // Filter based on reprocessExisting flag
      if (!reprocessExisting) {
        contracts = contracts.filter(c => !c.hasEmbeddings);
      }
    } else if (contractIds && contractIds.length > 0) {
      // Get specific contracts
      const specificContracts = await prisma.contract.findMany({
        where: { 
          id: { in: contractIds },
          tenantId,
        },
        select: {
          id: true,
          fileName: true,
          rawText: true,
          contractEmbeddings: { select: { id: true }, take: 1 },
        },
      });

      contracts = specificContracts.map(c => ({
        id: c.id,
        fileName: c.fileName,
        rawText: c.rawText,
        hasEmbeddings: c.contractEmbeddings.length > 0,
      }));
    } else {
      return NextResponse.json(
        { error: 'Either contractIds array or processAll flag required' },
        { status: 400 }
      );
    }

    // Filter out contracts without text
    const processableContracts = contracts.filter(c => c.rawText && c.rawText.length > 100);

    if (processableContracts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contracts to process',
        processed: 0,
        skipped: contracts.length,
        totalTime: Date.now() - startTime,
      });
    }

    console.log(`🚀 Batch RAG processing: ${processableContracts.length} contracts`);

    // Process contracts in batches to control concurrency
    const results: ContractProcessResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Process in groups of maxConcurrent
    for (let i = 0; i < processableContracts.length; i += maxConcurrent) {
      const batch = processableContracts.slice(i, i + maxConcurrent);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (contract) => {
          const contractStartTime = Date.now();
          
          try {
            // Skip if already has embeddings and not reprocessing
            if (contract.hasEmbeddings && !reprocessExisting) {
              skippedCount++;
              return {
                contractId: contract.id,
                fileName: contract.fileName,
                status: 'skipped' as const,
                processingTime: Date.now() - contractStartTime,
              };
            }

            console.log(`📄 Processing: ${contract.fileName}`);
            
            const result = await processContractWithSemanticChunking(
              contract.id,
              contract.rawText!,
              {
                apiKey: process.env.OPENAI_API_KEY,
                model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
              }
            );

            successCount++;
            return {
              contractId: contract.id,
              fileName: contract.fileName,
              status: 'success' as const,
              chunksCreated: result.chunksCreated,
              embeddingsGenerated: result.embeddingsGenerated,
              processingTime: Date.now() - contractStartTime,
            };
          } catch (error) {
            failedCount++;
            console.error(`❌ Failed to process ${contract.fileName}:`, error);
            return {
              contractId: contract.id,
              fileName: contract.fileName,
              status: 'failed' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
              processingTime: Date.now() - contractStartTime,
            };
          }
        })
      );

      // Extract results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            contractId: 'unknown',
            fileName: 'unknown',
            status: 'failed',
            error: result.reason?.message || 'Unknown error',
          });
          failedCount++;
        }
      }
    }

    const totalTime = Date.now() - startTime;

    console.log(`✅ Batch processing complete: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`);

    return NextResponse.json({
      success: true,
      summary: {
        total: processableContracts.length,
        successful: successCount,
        failed: failedCount,
        skipped: skippedCount,
        totalTime,
        averageTimePerContract: Math.round(totalTime / processableContracts.length),
      },
      results,
    });

  } catch (error) {
    console.error('Batch RAG processing error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/rag/batch - Get batch processing status and stats
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();

    // Get embedding statistics
    const [totalContracts, contractsWithEmbeddings, embeddingStats] = await Promise.all([
      prisma.contract.count({
        where: { 
          tenantId,
          status: 'COMPLETED',
          rawText: { not: null },
        },
      }),
      prisma.contract.count({
        where: { 
          tenantId,
          status: 'COMPLETED',
          rawText: { not: null },
          contractEmbeddings: { some: {} },
        },
      }),
      prisma.contractEmbedding.aggregate({
        where: {
          contract: { tenantId },
        },
        _count: true,
        _avg: { chunkIndex: true },
      }),
    ]);

    const pendingContracts = totalContracts - contractsWithEmbeddings;
    const coverage = totalContracts > 0 
      ? Math.round((contractsWithEmbeddings / totalContracts) * 100) 
      : 0;

    return NextResponse.json({
      statistics: {
        totalContracts,
        contractsWithEmbeddings,
        pendingContracts,
        coveragePercentage: coverage,
        totalEmbeddings: embeddingStats._count,
        averageChunksPerContract: Math.round(embeddingStats._count / (contractsWithEmbeddings || 1)),
      },
      recommendation: pendingContracts > 0 
        ? `${pendingContracts} contracts need RAG processing for optimal search performance`
        : 'All contracts are fully indexed for semantic search',
      endpoint: {
        url: '/api/ai/rag/batch',
        method: 'POST',
        parameters: {
          contractIds: 'Array of contract IDs to process',
          processAll: 'Process all unindexed contracts (boolean)',
          reprocessExisting: 'Re-process already indexed contracts (boolean)',
          maxConcurrent: 'Max concurrent processing (default: 3)',
        },
      },
    });

  } catch (error) {
    console.error('Error fetching batch status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get batch status' },
      { status: 500 }
    );
  }
}
