/**
 * Batch RAG Processing API
 * 
 * POST /api/rag/batch-process - Reprocess multiple contracts with semantic chunking
 * GET /api/rag/batch-process - Get batch processing status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processContractWithSemanticChunking } from '@/lib/rag/advanced-rag.service';
import { getServerTenantId } from '@/lib/tenant-server';

// Track batch processing status
const batchStatus = new Map<string, {
  status: 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  failed: number;
  startTime: number;
  endTime?: number;
  results: Array<{ contractId: string; success: boolean; error?: string }>;
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractIds, limit = 50, forceReprocess = false } = body;

    const tenantId = await getServerTenantId();
    
    console.log(`🔄 Batch RAG processing for tenant: ${tenantId}`);

    // Find contracts to process
    const whereClause: Record<string, unknown> = { tenantId };
    
    if (contractIds && contractIds.length > 0) {
      whereClause.id = { in: contractIds };
    }

    // If not force reprocessing, only process contracts without embeddings
    if (!forceReprocess) {
      whereClause.embeddings = { none: {} };
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        fileName: true,
        rawText: true,
        _count: { select: { embeddings: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    if (contracts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contracts to process',
        processed: 0,
        skipped: 0,
      });
    }

    // Filter to contracts with text
    const contractsWithText = contracts.filter(c => c.rawText && c.rawText.length > 100);
    
    if (contractsWithText.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contracts with extractable text found',
        processed: 0,
        skipped: contracts.length,
      });
    }

    // Create batch ID
    const batchId = `batch-${Date.now()}`;
    
    // Initialize status
    batchStatus.set(batchId, {
      status: 'running',
      total: contractsWithText.length,
      processed: 0,
      failed: 0,
      startTime: Date.now(),
      results: [],
    });

    // Process contracts in background (don't await)
    processBatch(batchId, contractsWithText).catch(console.error);

    return NextResponse.json({
      success: true,
      batchId,
      message: `Started processing ${contractsWithText.length} contracts`,
      total: contractsWithText.length,
      skipped: contracts.length - contractsWithText.length,
      statusUrl: `/api/rag/batch-process?batchId=${batchId}`,
    });

  } catch (error) {
    console.error('Batch RAG processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function processBatch(
  batchId: string,
  contracts: Array<{ id: string; fileName: string; rawText: string | null }>
) {
  const status = batchStatus.get(batchId);
  if (!status) return;

  for (const contract of contracts) {
    try {
      if (!contract.rawText) {
        status.results.push({
          contractId: contract.id,
          success: false,
          error: 'No text content',
        });
        status.failed++;
        continue;
      }

      console.log(`📄 Processing: ${contract.fileName}`);
      
      await processContractWithSemanticChunking(
        contract.id,
        contract.rawText,
        {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small',
        }
      );

      status.results.push({
        contractId: contract.id,
        success: true,
      });
      status.processed++;
      
    } catch (error) {
      console.error(`Failed to process ${contract.id}:`, error);
      status.results.push({
        contractId: contract.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      status.failed++;
    }
  }

  status.status = status.failed === contracts.length ? 'failed' : 'completed';
  status.endTime = Date.now();
  
  console.log(`✅ Batch ${batchId} complete: ${status.processed}/${status.total} successful`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId');

  if (batchId) {
    const status = batchStatus.get(batchId);
    
    if (!status) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      batchId,
      ...status,
      processingTime: status.endTime 
        ? status.endTime - status.startTime 
        : Date.now() - status.startTime,
    });
  }

  // Return all batch statuses
  const allBatches = Array.from(batchStatus.entries()).map(([id, s]) => ({
    batchId: id,
    status: s.status,
    total: s.total,
    processed: s.processed,
    failed: s.failed,
    startTime: new Date(s.startTime).toISOString(),
    endTime: s.endTime ? new Date(s.endTime).toISOString() : undefined,
  }));

  return NextResponse.json({
    batches: allBatches.slice(-10), // Last 10 batches
    activeBatches: allBatches.filter(b => b.status === 'running').length,
  });
}
