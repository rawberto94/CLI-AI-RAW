/**
 * RAG Indexing Worker
 * 
 * Automatically processes contracts for semantic search after OCR completion.
 * Can be triggered manually or automatically after contract processing.
 * 
 * Features:
 * - Semantic chunking with document structure awareness
 * - Batch embedding generation with OpenAI
 * - Progress tracking and error handling
 * - Integration with contract processing pipeline
 */

// Use local type definition for cross-package compatibility
type Job<T = any> = { id?: string; name: string; data: T; attemptsMade: number; opts: any };
import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
import { getQueueService, JobType } from '@repo/utils/queue/queue-service';
import { QUEUE_NAMES, IndexContractJobData } from '@repo/utils/queue/contract-queue';
import pino from 'pino';

import { getTraceContextFromJobData } from './observability/trace';
import { isRetryableError, RetryableError } from './utils/errors';
import { sha256 } from './utils/hash';
import { ensureProcessingJob, updateStep, assertRetryableReady } from './workflow/processing-job';
import { getWorkerConcurrency, getWorkerLimiter } from './config/worker-runtime';

const logger = pino({ name: 'rag-indexing-worker' });
const prisma = getClient();

// Preload OpenAI module
let openaiModule: any = null;
(async () => {
  try {
    openaiModule = await import('openai');
    logger.info('OpenAI module preloaded');
  } catch (e) {
    logger.warn('Failed to preload OpenAI module, will load on-demand');
  }
})();

interface SemanticChunk {
  index: number;
  text: string;
  metadata: {
    section?: string;
    heading?: string;
    chunkType: 'heading' | 'paragraph' | 'list' | 'table' | 'clause';
    startChar: number;
    endChar: number;
    wordCount: number;
  };
}

interface RAGIndexingResult {
  success: boolean;
  contractId: string;
  chunksCreated: number;
  embeddingsGenerated: number;
  processingTime: number;
  error?: string;
}

/**
 * Semantic chunking - splits text by document structure
 */
function semanticChunk(
  text: string,
  options: { maxChunkSize?: number; minChunkSize?: number; overlap?: number } = {}
): SemanticChunk[] {
  const { maxChunkSize = 1500, minChunkSize = 200, overlap = 100 } = options;
  
  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;
  
  // Detect document structure patterns
  const headingPattern = /^(?:#{1,6}\s+|(?:\d+\.)+\s+|[A-Z][A-Z\s]{2,}:?\s*$|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+)/gm;
  const listPattern = /^(?:\s*[-•*]\s+|\s*\d+[.)]\s+)/gm;
  const tablePattern = /\|.*\|/g;
  
  // Split by major sections first
  const sections = text.split(/\n(?=(?:#{1,3}\s+|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+))/i);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // Extract heading if present
    const headingMatch = section.match(headingPattern);
    const heading = headingMatch ? headingMatch[0].trim() : undefined;
    
    // Determine chunk type
    let chunkType: SemanticChunk['metadata']['chunkType'] = 'paragraph';
    if (heading) chunkType = 'heading';
    else if (listPattern.test(section)) chunkType = 'list';
    else if (tablePattern.test(section)) chunkType = 'table';
    else if (/clause|term|condition|obligation/i.test(section)) chunkType = 'clause';
    
    // If section is small enough, keep as single chunk
    if (section.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: section.trim(),
        metadata: {
          section: heading,
          heading,
          chunkType,
          startChar: text.indexOf(section),
          endChar: text.indexOf(section) + section.length,
          wordCount: section.split(/\s+/).length,
        },
      });
      continue;
    }
    
    // Split large sections by paragraphs
    const paragraphs = section.split(/\n\n+/);
    let currentChunk = '';
    let chunkStartChar = text.indexOf(section);
    
    for (const para of paragraphs) {
      if (!para.trim()) continue;
      
      if (currentChunk.length + para.length > maxChunkSize && currentChunk.length >= minChunkSize) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          metadata: {
            section: heading,
            heading,
            chunkType,
            startChar: chunkStartChar,
            endChar: chunkStartChar + currentChunk.length,
            wordCount: currentChunk.split(/\s+/).length,
          },
        });
        
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + para;
        chunkStartChar = text.indexOf(currentChunk) || chunkStartChar + currentChunk.length - overlap;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }
    
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        metadata: {
          section: heading,
          heading,
          chunkType,
          startChar: chunkStartChar,
          endChar: chunkStartChar + currentChunk.length,
          wordCount: currentChunk.split(/\s+/).length,
        },
      });
    }
  }
  
  return chunks;
}

/**
 * Process RAG indexing job
 */
export async function processRAGIndexingJob(
  job: JobType<IndexContractJobData>
): Promise<RAGIndexingResult> {
  const startTime = Date.now();
  const { contractId, tenantId } = job.data;
  const trace = getTraceContextFromJobData(job.data);
  const jobLogger = logger.child({ jobId: job.id, contractId, tenantId });
  
  jobLogger.info('Starting RAG indexing');
  
  try {
    await ensureProcessingJob({
      tenantId,
      contractId,
      queueId: job.id ? String(job.id) : undefined,
      traceId: trace.traceId,
    });

    await updateStep({
      tenantId,
      contractId,
      step: 'rag.indexing',
      status: 'running',
      progress: 5,
      currentStep: 'rag.indexing',
    });

    await job.updateProgress(5);
    
    // Get contract with text and status
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        rawText: true,
        fileName: true,
        tenantId: true,
        status: true,
      },
    });
    
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }
    
    // Check if contract is ready for indexing (completed or partial processing)
    assertRetryableReady({
      status: contract.status,
      message: `Contract status is ${contract.status}, waiting for processing to complete`,
    });
    
    if (!contract.rawText) {
      throw new RetryableError('No text content available yet');
    }
    
    await job.updateProgress(10);
    
    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    // Semantic chunking
    jobLogger.info({ textLength: contract.rawText.length }, 'Creating semantic chunks');
    const chunks = semanticChunk(contract.rawText);
    jobLogger.info({ chunkCount: chunks.length }, 'Chunks created');
    
    if (chunks.length === 0) {
      return {
        success: true,
        contractId,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        processingTime: Date.now() - startTime,
      };
    }
    
    await job.updateProgress(30);
    
    // Generate embeddings in batches with retry and rate limit handling
    const OpenAI = openaiModule?.default || (await import('openai')).default;
    const openai = new OpenAI({ apiKey });
    const model = process.env.RAG_EMBED_MODEL || 'text-embedding-3-small';

    // Idempotency: skip if we've already indexed the same rawText with the same embedding model.
    const rawTextHash = sha256(contract.rawText);
    const existingMetadata = await prisma.contractMetadata.findUnique({
      where: { contractId },
      select: { systemFields: true, embeddingVersion: true, embeddingCount: true },
    });

    const systemFields = (existingMetadata?.systemFields ?? {}) as any;
    const prevHash = systemFields?.ragIndexing?.rawTextHash as string | undefined;
    if (existingMetadata?.embeddingVersion === model && prevHash === rawTextHash && (existingMetadata.embeddingCount ?? 0) > 0) {
      jobLogger.info({ model, embeddingCount: existingMetadata.embeddingCount }, 'RAG indexing skipped (no text changes)');
      await job.updateProgress(100);
      await updateStep({
        tenantId,
        contractId,
        step: 'rag.indexing',
        status: 'skipped',
        progress: 100,
        currentStep: 'rag.indexing',
      });
      return {
        success: true,
        contractId,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        processingTime: Date.now() - startTime,
      };
    }
    
    const BATCH_SIZE = 32;
    const MAX_RETRIES = 3;
    const embeddings: number[][] = [];
    
    // Helper for retrying with exponential backoff
    async function retryWithBackoff<T>(
      fn: () => Promise<T>,
      retries = MAX_RETRIES,
      baseDelay = 1000
    ): Promise<T> {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          return await fn();
        } catch (error: any) {
          const isRateLimit = error?.status === 429 || error?.code === 'rate_limit_exceeded';
          const isTransient = error?.status >= 500 || error?.code === 'ECONNRESET';
          
          if (attempt === retries || (!isRateLimit && !isTransient)) {
            throw error;
          }
          
          // Exponential backoff with jitter
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
          jobLogger.warn({ attempt, delay, error: error.message }, 'Retrying after error');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      throw new Error('Max retries exceeded');
    }
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map(c => c.text);
      
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
      
      jobLogger.info({ batch: batchNum, total: totalBatches }, 'Generating embeddings batch');
      
      const response = await retryWithBackoff(() => 
        openai.embeddings.create({ model, input: texts })
      ) as any;
      embeddings.push(...response.data.map((d: any) => d.embedding));
      
      // Update progress (30% to 80% during embedding)
      const progress = 30 + Math.round((i / chunks.length) * 50);
      await job.updateProgress(progress);
    }
    
    await job.updateProgress(85);
    
    // Store in database
    jobLogger.info('Storing embeddings in database');
    
    // Delete existing embeddings
    await prisma.contractEmbedding.deleteMany({ where: { contractId } });
    
    // Prepare batch insert using raw SQL for vector type
    const { toSql } = await import('pgvector/utils');
    
    const records = chunks.map((chunk, i) => ({
      contractId,
      chunkIndex: chunk.index,
      chunkText: chunk.text,
      embedding: toSql(embeddings[i]),
      chunkType: chunk.metadata.chunkType,
      section: chunk.metadata.section || null,
    }));
    
    // Insert in batches to avoid parameter limits
    const INSERT_BATCH = 50;
    for (let i = 0; i < records.length; i += INSERT_BATCH) {
      const batch = records.slice(i, i + INSERT_BATCH);
      
      const values = batch.map((r, idx) => 
        `(gen_random_uuid(), '${r.contractId}', ${r.chunkIndex}, $${idx * 2 + 1}, '${r.embedding}'::vector, $${idx * 2 + 2}, ${r.section ? `'${r.section.replace(/'/g, "''")}'` : 'NULL'}, NOW(), NOW())`
      ).join(', ');
      
      const params = batch.flatMap(r => [r.chunkText, r.chunkType]);
      
      await prisma.$executeRawUnsafe(`
        INSERT INTO "ContractEmbedding" ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "createdAt", "updatedAt")
        VALUES ${values}
      `, ...params);
    }
    
    await job.updateProgress(95);
    
    // Update contract metadata to mark as RAG-indexed
    await prisma.contractMetadata.upsert({
      where: { contractId },
      update: { 
        ragSyncedAt: new Date(),
        embeddingVersion: model,
        embeddingCount: embeddings.length,
        lastEmbeddingAt: new Date(),
        systemFields: {
          ...(existingMetadata?.systemFields as any),
          ragIndexing: {
            rawTextHash,
            model,
            indexedAt: new Date().toISOString(),
          },
        },
      },
      create: {
        contractId,
        tenantId,
        ragSyncedAt: new Date(),
        updatedBy: 'system',
        embeddingVersion: model,
        embeddingCount: embeddings.length,
        lastEmbeddingAt: new Date(),
        systemFields: {
          ragIndexing: {
            rawTextHash,
            model,
            indexedAt: new Date().toISOString(),
          },
        },
      },
    });
    
    await job.updateProgress(100);
    
    const processingTime = Date.now() - startTime;
    
    jobLogger.info({
      chunksCreated: chunks.length,
      embeddingsGenerated: embeddings.length,
      processingTime,
    }, 'RAG indexing completed');

    await updateStep({
      tenantId,
      contractId,
      step: 'rag.indexing',
      status: 'completed',
      progress: 100,
      currentStep: 'rag.indexing',
    });
    
    return {
      success: true,
      contractId,
      chunksCreated: chunks.length,
      embeddingsGenerated: embeddings.length,
      processingTime,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    jobLogger.error({ error: errorMessage, traceId: trace.traceId }, 'RAG indexing failed');

    await updateStep({
      tenantId,
      contractId,
      step: 'rag.indexing',
      status: 'failed',
      progress: 100,
      currentStep: 'rag.indexing',
      error: errorMessage,
    });

    // Let BullMQ handle retries/backoff; only swallow if you truly want "best-effort".
    if (isRetryableError(error)) {
      throw error;
    }
    throw error;
  }
}

/**
 * Register RAG indexing worker
 */
export function registerRAGIndexingWorker() {
  const queueService = getQueueService();

  const concurrency = getWorkerConcurrency('RAG_WORKER_CONCURRENCY', 3);
  const limiter = getWorkerLimiter('RAG_WORKER_LIMIT_MAX', 'RAG_WORKER_LIMIT_DURATION_MS', { max: 20, duration: 60000 });
  
  logger.info({ concurrency }, 'Registering RAG indexing worker');
  
  const worker = queueService.registerWorker<IndexContractJobData, RAGIndexingResult>(
    QUEUE_NAMES.RAG_INDEXING,
    processRAGIndexingJob,
    {
      concurrency,
      limiter,
      // Note: BullMQ settings like maxStalledCount and stalledInterval are configured
      // at the BullMQ Worker level, not through our queue-service wrapper
    }
  );
  
  logger.info('RAG indexing worker registered');
  
  return worker;
}

/**
 * Queue RAG indexing for a contract
 */
export async function queueRAGIndexing(
  contractId: string,
  tenantId: string,
  options?: { priority?: number; delay?: number }
): Promise<string | null> {
  const queueService = getQueueService();
  
  const job = await queueService.addJob(
    QUEUE_NAMES.RAG_INDEXING,
    'index-contract',
    { contractId, tenantId, artifactIds: [] },
    {
      priority: options?.priority || 15,
      delay: options?.delay || 5000, // Small delay to let OCR artifacts settle
      jobId: `rag-${contractId}`,
    }
  );
  
  logger.info({ jobId: job?.id, contractId }, 'RAG indexing job queued');
  
  return job?.id || null;
}

// Start worker if this file is run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  logger.info('Starting RAG indexing worker...');
  
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  getQueueService({
    redis: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 5000 },
    },
  });
  
  registerRAGIndexingWorker();
  
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    process.exit(0);
  });
}
