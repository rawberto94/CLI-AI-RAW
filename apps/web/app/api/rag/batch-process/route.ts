/**
 * Batch RAG Processing API
 * 
 * POST /api/rag/batch-process - Reprocess multiple contracts with semantic chunking
 * GET /api/rag/batch-process - Get batch processing status
 * 
 * Batch status is persisted in Redis (shared across instances) with an in-memory
 * fallback for environments without Redis.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processContractWithSemanticChunking } from '@/lib/rag/advanced-rag.service';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { aiArtifactGeneratorService } from 'data-orchestration/services';

// ============================================================================
// Redis-backed batch status store (with in-memory fallback)
// ============================================================================

interface BatchStatusEntry {
  status: 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  failed: number;
  startTime: number;
  endTime?: number;
  results: Array<{ contractId: string; success: boolean; error?: string }>;
}

const REDIS_BATCH_PREFIX = 'rag:batch:';
const BATCH_TTL_SECONDS = 86400; // 24 hours

/** In-memory fallback when Redis is unavailable */
const memoryBatchStatus = new Map<string, BatchStatusEntry>();

let _redis: any = null;
let _redisReady = false;

async function getBatchRedis(): Promise<any> {
  if (_redisReady) return _redis;
  if (_redis === null && process.env.REDIS_URL) {
    try {
      const Redis = (await import('ioredis')).default;
      _redis = new Redis(process.env.REDIS_URL, {
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await _redis.connect();
      _redisReady = true;
    } catch {
      _redis = null;
      _redisReady = false;
    }
  }
  return _redisReady ? _redis : null;
}

async function setBatchStatus(batchId: string, entry: BatchStatusEntry): Promise<void> {
  // Always keep in-memory for fast in-process access
  memoryBatchStatus.set(batchId, entry);

  const r = await getBatchRedis();
  if (r) {
    try {
      await r.set(`${REDIS_BATCH_PREFIX}${batchId}`, JSON.stringify(entry), 'EX', BATCH_TTL_SECONDS);
    } catch { /* Redis write failed — in-memory is still updated */ }
  }
}

async function getBatchStatus(batchId: string): Promise<BatchStatusEntry | null> {
  // Try in-memory first (hot path)
  const mem = memoryBatchStatus.get(batchId);
  if (mem) return mem;

  // Fall back to Redis
  const r = await getBatchRedis();
  if (r) {
    try {
      const raw = await r.get(`${REDIS_BATCH_PREFIX}${batchId}`);
      if (raw) {
        const entry: BatchStatusEntry = JSON.parse(raw);
        memoryBatchStatus.set(batchId, entry); // promote to memory
        return entry;
      }
    } catch { /* Redis read failed */ }
  }
  return null;
}

async function getAllBatchStatuses(): Promise<Array<{ batchId: string } & BatchStatusEntry>> {
  // Gather from memory first
  const results = new Map<string, BatchStatusEntry>();
  for (const [id, s] of memoryBatchStatus) {
    results.set(id, s);
  }

  // Also scan Redis for entries from other instances
  const r = await getBatchRedis();
  if (r) {
    try {
      const keys = await r.keys(`${REDIS_BATCH_PREFIX}*`);
      for (const key of keys) {
        const batchId = key.replace(REDIS_BATCH_PREFIX, '');
        if (!results.has(batchId)) {
          const raw = await r.get(key);
          if (raw) results.set(batchId, JSON.parse(raw));
        }
      }
    } catch { /* Redis scan failed */ }
  }

  return Array.from(results.entries()).map(([batchId, s]) => ({ batchId, ...s }));
}

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { contractIds, limit = 50, forceReprocess = false } = body;

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
        _count: { select: { embeddings: true } } },
      take: limit,
      orderBy: { createdAt: 'desc' } });

    if (contracts.length === 0) {
      return createSuccessResponse(ctx, {
        message: 'No contracts to process',
        processed: 0,
        skipped: 0 });
    }

    // Filter to contracts with text
    const contractsWithText = contracts.filter(c => c.rawText && c.rawText.length > 100);
    
    if (contractsWithText.length === 0) {
      return createSuccessResponse(ctx, {
        message: 'No contracts with extractable text found',
        processed: 0,
        skipped: contracts.length });
    }

    // Create batch ID
    const batchId = `batch-${Date.now()}`;
    
    // Initialize status
    await setBatchStatus(batchId, {
      status: 'running',
      total: contractsWithText.length,
      processed: 0,
      failed: 0,
      startTime: Date.now(),
      results: [] });

    // Process contracts in background (don't await)
    processBatch(batchId, contractsWithText).catch(() => {
      // Background processing error - status tracked in batchStatus
    });

    return createSuccessResponse(ctx, {
      batchId,
      message: `Started processing ${contractsWithText.length} contracts`,
      total: contractsWithText.length,
      skipped: contracts.length - contractsWithText.length,
      statusUrl: `/api/rag/batch-process?batchId=${batchId}` });

  });

async function processBatch(
  batchId: string,
  contracts: Array<{ id: string; fileName: string; rawText: string | null }>
) {
  const status = await getBatchStatus(batchId);
  if (!status) return;

  for (const contract of contracts) {
    try {
      if (!contract.rawText) {
        status.results.push({
          contractId: contract.id,
          success: false,
          error: 'No text content' });
        status.failed++;
        await setBatchStatus(batchId, status);
        continue;
      }

      await processContractWithSemanticChunking(
        contract.id,
        contract.rawText,
        {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small' }
      );

      status.results.push({
        contractId: contract.id,
        success: true });
      status.processed++;
      await setBatchStatus(batchId, status);
      
    } catch (error) {
      status.results.push({
        contractId: contract.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' });
      status.failed++;
      await setBatchStatus(batchId, status);
    }
  }

  status.status = status.failed === contracts.length ? 'failed' : 'completed';
  status.endTime = Date.now();
  await setBatchStatus(batchId, status);
}

export const GET = withAuthApiHandler(async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId');

  if (batchId) {
    const status = await getBatchStatus(batchId);
    
    if (!status) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Batch not found', 404);
    }

    return createSuccessResponse(ctx, {
      batchId,
      ...status,
      processingTime: status.endTime 
        ? status.endTime - status.startTime 
        : Date.now() - status.startTime });
  }

  // Return all batch statuses
  const allBatches = (await getAllBatchStatuses()).map(s => ({
    batchId: s.batchId,
    status: s.status,
    total: s.total,
    processed: s.processed,
    failed: s.failed,
    startTime: new Date(s.startTime).toISOString(),
    endTime: s.endTime ? new Date(s.endTime).toISOString() : undefined }));

  return createSuccessResponse(ctx, {
    batches: allBatches.slice(-10), // Last 10 batches
    activeBatches: allBatches.filter(b => b.status === 'running').length });
});
