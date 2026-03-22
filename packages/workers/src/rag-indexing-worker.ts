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

import { semanticChunk, type SemanticChunk } from '@repo/utils/rag/semantic-chunker';
import { adaptiveChunk, type EmbedFn } from '@repo/utils/rag/adaptive-chunker';

interface RAGIndexingResult {
  success: boolean;
  contractId: string;
  chunksCreated: number;
  embeddingsGenerated: number;
  processingTime: number;
  error?: string;
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
        aiMetadata: true,
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
    
    // Semantic chunking (adaptive or regex-based)
    jobLogger.info({ textLength: contract.rawText.length }, 'Creating semantic chunks');
    let rawChunks: SemanticChunk[];

    if (process.env.RAG_ADAPTIVE_CHUNKING === 'true' && apiKey) {
      // Adaptive chunking — splits at true semantic boundaries using embeddings
      jobLogger.info('Using adaptive embedding-based chunking');
      const OpenAIEmbed = openaiModule?.default || (await import('openai')).default;
      const embedClient = new OpenAIEmbed({ apiKey });
      const embedModel = process.env.RAG_EMBED_MODEL || 'text-embedding-3-small';

      const embedFn: EmbedFn = async (texts: string[]) => {
        // Batch in groups of 64 to stay within API limits
        const EMBED_BATCH = 64;
        const embedDims = parseInt(process.env.RAG_EMBED_DIMENSIONS || '0', 10);
        const all: number[][] = [];
        for (let b = 0; b < texts.length; b += EMBED_BATCH) {
          const batch = texts.slice(b, b + EMBED_BATCH);
          const params: any = { model: embedModel, input: batch };
          if (embedDims > 0 && embedModel.includes('text-embedding-3')) params.dimensions = embedDims;
          const res = await embedClient.embeddings.create(params);
          all.push(...res.data.map((d: any) => d.embedding));
        }
        return all;
      };

      rawChunks = await adaptiveChunk(contract.rawText, embedFn, {
        maxChunkSize: 1500,
        minChunkSize: 200,
        overlap: 100,
        breakpointPercentile: 1.0,
      });
    } else {
      // Default: regex-based structural chunking (zero-dependency, deterministic)
      // Pass DI paragraph hints when available for structure-aware chunking
      const aiMeta = (contract.aiMetadata as any) ?? {};
      const diParagraphs = Array.isArray(aiMeta.diParagraphs) ? aiMeta.diParagraphs : undefined;
      rawChunks = semanticChunk(contract.rawText, diParagraphs ? { diParagraphs } : undefined);
    }

    jobLogger.info({ chunkCount: rawChunks.length }, 'Chunks created');
    
    if (rawChunks.length === 0) {
      return {
        success: true,
        contractId,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        processingTime: Date.now() - startTime,
      };
    }

    // Step 1.5: Contextual Retrieval — Anthropic-style chunk contextualization
    // Prepend a 1-2 sentence context prefix per chunk for +49% retrieval accuracy.
    // Uses gpt-4o-mini; gracefully degrades on failure.
    let chunks = rawChunks;
    try {
      const ctxApiKey = process.env.OPENAI_API_KEY;
      if (ctxApiKey) {
        const OpenAICtx = openaiModule?.default || (await import('openai')).default;
        const ctxClient = new OpenAICtx({ apiKey: ctxApiKey });

        // Document summary (first 6K chars → gpt-4o-mini)
        const summaryRes = await ctxClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Summarize this contract in 3-4 sentences. Include: document type, parties involved, primary subject matter, and key terms. Be factual and concise.' },
            { role: 'user', content: contract.rawText.slice(0, 6000) },
          ],
          temperature: 0,
          max_tokens: 200,
        });
        const docSummary = summaryRes.choices[0]?.message?.content || '';

        if (docSummary) {
          const CTX_BATCH = 5;
          const contextualized = [...rawChunks];
          for (let ci = 0; ci < rawChunks.length; ci += CTX_BATCH) {
            const ctxBatch = rawChunks.slice(ci, ci + CTX_BATCH);
            try {
              // Batch all chunks in one LLM call with JSON array output
              const batchPrompt = ctxBatch.map((c, idx) => 
                `CHUNK_${idx}: [Section: ${c.metadata.section || 'N/A'}] ${c.text.slice(0, 600)}`
              ).join('\n\n');

              const res = await ctxClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: `You contextualize contract chunks for a retrieval system. Given a document summary and multiple chunks, write a 1-2 sentence context prefix for EACH chunk that identifies its location in the document and provides enough context for standalone understanding.
Return a JSON array of strings, one prefix per chunk, in the same order. Return ONLY the JSON array, no other text.`,
                  },
                  {
                    role: 'user',
                    content: `Document Summary: ${docSummary}\n\n${batchPrompt}`,
                  },
                ],
                temperature: 0,
                max_tokens: 150 * ctxBatch.length,
                response_format: { type: 'json_object' },
              });

              const raw = res.choices[0]?.message?.content?.trim() || '{}';
              let prefixes: string[] = [];
              try {
                const parsed = JSON.parse(raw);
                prefixes = Array.isArray(parsed) ? parsed : (parsed.prefixes || parsed.contexts || Object.values(parsed));
              } catch {
                prefixes = [];
              }

              for (let j = 0; j < ctxBatch.length; j++) {
                const prefix = typeof prefixes[j] === 'string' ? prefixes[j] : '';
                if (prefix) {
                  contextualized[ci + j] = {
                    ...rawChunks[ci + j]!,
                    text: `[Context: ${prefix}]\n\n${rawChunks[ci + j]!.text}`,
                  };
                }
              }
            } catch {
              // Batch failed — skip this batch, chunks keep original text
            }
          }
          chunks = contextualized;
          jobLogger.info({ contextualizedCount: chunks.length }, 'Contextual retrieval applied (batched)');
        }
      }
    } catch (ctxErr) {
      jobLogger.warn({ error: (ctxErr as Error).message }, 'Contextual retrieval skipped (non-fatal)');
      // Continue with original chunks — graceful degradation
    }
    
    await job.updateProgress(28);
    
    // Step 2: RAPTOR hierarchical summarization
    // Build multi-level summaries and append them as extra embeddable chunks
    if (process.env.RAG_RAPTOR_ENABLED === 'true' && apiKey) {
      try {
        const { buildRaptorTree, getRaptorSummaryChunks } = await import('@repo/utils/rag/raptor-summarizer');
        const OpenAIRaptor = openaiModule?.default || (await import('openai')).default;
        const raptorClient = new OpenAIRaptor({ apiKey });
        
        const summarize = async (texts: string[], instruction: string): Promise<string> => {
          const res = await raptorClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: instruction },
              { role: 'user', content: texts.join('\n\n---\n\n') },
            ],
            temperature: 0,
            max_tokens: 400,
          });
          return res.choices[0]?.message?.content?.trim() || '';
        };
        
        const tree = await buildRaptorTree(
          chunks.map(c => c.text),
          summarize,
          contractId,
        );
        
        const summaryChunks = getRaptorSummaryChunks(tree);
        if (summaryChunks.length > 0) {
          const baseIndex = chunks.length;
          for (let si = 0; si < summaryChunks.length; si++) {
            const sc = summaryChunks[si]!;
            chunks.push({
              index: baseIndex + si,
              text: sc.text,
              metadata: {
                chunkType: 'paragraph' as const,
                section: `RAPTOR Level ${sc.level} Summary`,
                startChar: 0,
                endChar: sc.text.length,
                wordCount: sc.text.split(/\s+/).length,
              },
            });
          }
          jobLogger.info({ raptorSummaries: summaryChunks.length, levels: tree.levels }, 'RAPTOR hierarchical summaries added');
        }
      } catch (raptorErr) {
        jobLogger.warn({ error: (raptorErr as Error).message }, 'RAPTOR summarization skipped (non-fatal)');
      }
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
      baseDelay = 1000,
      maxTotalMs = 60_000
    ): Promise<T> {
      const deadline = Date.now() + maxTotalMs;
      for (let attempt = 1; attempt <= retries; attempt++) {
        if (Date.now() > deadline) throw new Error('Retry deadline exceeded');
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
      
      const embDims = parseInt(process.env.RAG_EMBED_DIMENSIONS || '0', 10);
      const embParams: any = { model, input: texts };
      if (embDims > 0 && model.includes('text-embedding-3')) embParams.dimensions = embDims;
      const response = await retryWithBackoff(() => 
        openai.embeddings.create(embParams, { signal: AbortSignal.timeout(30_000) })
      ) as any;
      embeddings.push(...response.data.map((d: any) => d.embedding));
      
      // Update progress (30% to 80% during embedding)
      const progress = 30 + Math.round((i / chunks.length) * 50);
      await job.updateProgress(progress);
    }
    
    await job.updateProgress(85);
    
    // Store in database — atomic delete+reinsert inside a transaction
    // to prevent zero-embedding window if worker crashes mid-reindex
    jobLogger.info('Storing embeddings in database (atomic transaction)');
    
    const { toSql } = await import('pgvector/utils');
    
    const records = chunks.map((chunk, i) => ({
      contractId,
      chunkIndex: chunk.index,
      chunkText: chunk.text,
      embedding: toSql(embeddings[i]),
      chunkType: chunk.metadata.chunkType,
      section: chunk.metadata.section || null,
    }));
    
    await prisma.$transaction(async (tx: any) => {
      // Delete existing embeddings
      await tx.contractEmbedding.deleteMany({ where: { contractId } });
      
      // Insert in batches to avoid parameter limits
      const INSERT_BATCH = 50;
      for (let i = 0; i < records.length; i += INSERT_BATCH) {
        const batch = records.slice(i, i + INSERT_BATCH);
        
        // Build fully-parameterized values list (no string interpolation)
        const paramParts: string[] = [];
        const params: unknown[] = [];
        for (let idx = 0; idx < batch.length; idx++) {
          const offset = idx * 6;
          paramParts.push(
            `(gen_random_uuid(), $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::vector, $${offset + 5}, $${offset + 6}, NOW(), NOW())`
          );
          const r = batch[idx]!;
          params.push(r.contractId, r.chunkIndex, r.chunkText, r.embedding, r.chunkType, r.section ?? null);
        }
        
        await tx.$executeRawUnsafe(
          `INSERT INTO "ContractEmbedding" ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "createdAt", "updatedAt") VALUES ${paramParts.join(', ')}`,
          ...params,
        );
      }
    }, { timeout: 60000 });
    
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

    // Fire event trigger for post-upload intelligence pipeline
    try {
      const { fireEventTrigger } = await import('./autonomous-scheduler');
      await fireEventTrigger('contract_indexed', {
        contractId,
        tenantId,
        chunksCreated: chunks.length,
        embeddingsGenerated: embeddings.length,
      });
    } catch (triggerErr) {
      jobLogger.warn({ error: (triggerErr as Error).message }, 'Event trigger fire failed (non-fatal)');
    }
    
    return {
      success: true,
      contractId,
      chunksCreated: chunks.length,
      embeddingsGenerated: embeddings.length,
      processingTime,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isQuotaError = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('billing');
    const isMissingKey = errorMessage.includes('OPENAI_API_KEY');
    
    jobLogger.error({ error: errorMessage, traceId: trace.traceId, isQuotaError }, 'RAG indexing embedding failed');

    // FALLBACK: Store chunks WITHOUT embeddings so BM25 keyword search still works
    // This mirrors the pattern in rag-integration.service.ts
    if (!isMissingKey) {
      try {
        const contract = await prisma.contract.findFirst({
          where: { id: contractId, tenantId },
          select: { rawText: true },
        });
        
        if (contract?.rawText) {
          const fallbackChunks = semanticChunk(contract.rawText);
          if (fallbackChunks.length > 0) {
            jobLogger.info({ chunkCount: fallbackChunks.length }, 'Storing chunks WITHOUT embeddings for BM25 keyword search fallback');
            
            // Atomic delete+reinsert for fallback path too
            await prisma.$transaction(async (tx: any) => {
              await tx.contractEmbedding.deleteMany({ where: { contractId } });
              
              for (const chunk of fallbackChunks) {
                await tx.contractEmbedding.create({
                  data: {
                    contractId,
                    chunkIndex: chunk.index,
                    chunkText: chunk.text,
                    chunkType: chunk.metadata.chunkType,
                    section: chunk.metadata.section || null,
                  },
                });
              }
            }, { timeout: 30000 });
            
            // Mark as partially indexed (chunks stored, no vectors)
            await prisma.contractMetadata.upsert({
              where: { contractId },
              update: {
                embeddingVersion: 'text-only',
                embeddingCount: fallbackChunks.length,
                lastEmbeddingAt: new Date(),
                systemFields: {
                  ragIndexing: {
                    rawTextHash: sha256(contract.rawText),
                    model: 'text-only',
                    indexedAt: new Date().toISOString(),
                    embeddingFailed: true,
                    failureReason: errorMessage.substring(0, 500),
                  },
                },
              },
              create: {
                contractId,
                tenantId,
                updatedBy: 'system',
                embeddingVersion: 'text-only',
                embeddingCount: fallbackChunks.length,
                lastEmbeddingAt: new Date(),
                systemFields: {
                  ragIndexing: {
                    rawTextHash: sha256(contract.rawText),
                    model: 'text-only',
                    indexedAt: new Date().toISOString(),
                    embeddingFailed: true,
                    failureReason: errorMessage.substring(0, 500),
                  },
                },
              },
            });
            
            jobLogger.info({ chunksStored: fallbackChunks.length }, 'Text-only chunks stored for BM25 fallback');
          }
        }
      } catch (fallbackError) {
        jobLogger.error({ error: fallbackError }, 'Failed to store text-only chunks fallback');
      }
    }

    await updateStep({
      tenantId,
      contractId,
      step: 'rag.indexing',
      status: (isQuotaError ? 'partial' : 'failed') as any,
      progress: 100,
      currentStep: 'rag.indexing',
      error: isQuotaError ? `Chunks stored without vectors (${errorMessage})` : errorMessage,
    });

    // For quota errors, don't burn through retries — the issue won't resolve in seconds
    if (isQuotaError) {
      jobLogger.warn('OpenAI quota exceeded — chunks stored for BM25, skipping vector generation');
      return {
        success: false,
        contractId,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        processingTime: Date.now() - startTime,
      } as any;
    }

    // Let BullMQ handle retries/backoff for transient errors
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
      lockDuration: 180_000,    // 3 min — embedding generation can be slow
      lockRenewTime: 45_000,
      stalledInterval: 45_000,
      maxStalledCount: 2,
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
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable must be configured');
  }
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
