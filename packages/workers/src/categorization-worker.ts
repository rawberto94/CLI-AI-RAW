/**
 * Contract Categorization Worker
 * 
 * Background worker that categorizes contracts using AI.
 * Runs after OCR/artifact generation to classify contracts.
 * 
 * Features:
 * - Multi-dimensional categorization
 * - Confidence scoring
 * - Auto-apply high-confidence results
 * - Queue low-confidence for review
 */

import type { Job } from "bullmq";
import { Worker } from "bullmq";
import pino from "pino";

import { getTraceContextFromJobData } from './observability/trace';
import { ensureProcessingJob, updateStep, assertRetryableReady } from './workflow/processing-job';
import { RetryableError } from './utils/errors';
import { sha256 } from './utils/hash';
import { getWorkerConcurrency, getWorkerLimiter } from './config/worker-runtime';

// ============================================================================
// TYPES
// ============================================================================

export interface CategorizationJobData {
  contractId: string;
  tenantId: string;
  /** Force re-categorization even if already categorized */
  forceRecategorize?: boolean;
  /** Auto-apply high-confidence results */
  autoApply?: boolean;
  /** Minimum confidence for auto-apply */
  autoApplyThreshold?: number;
  /** Priority of categorization */
  priority?: "high" | "normal" | "low";
  /** Source that triggered categorization */
  source?: "upload" | "manual" | "bulk" | "scheduled";
  /** Correlation ID propagated across worker pipeline */
  traceId?: string;
  /** Optional request correlation from API layer */
  requestId?: string;
}

export interface CategorizationResult {
  success: boolean;
  contractId: string;
  contractType?: string;
  industry?: string;
  riskLevel?: string;
  complexity?: number;
  overallConfidence: number;
  autoApplied: boolean;
  processingTimeMs: number;
  errors?: string[];
}

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

export const CATEGORIZATION_QUEUE = "contract-categorization";

export const CATEGORIZATION_CONFIG = {
  name: CATEGORIZATION_QUEUE,
  concurrency: 10,
  limiter: {
    max: 60,
    duration: 60000, // 60 per minute
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 3000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 60 * 60,
    },
    removeOnFail: {
      count: 500,
      age: 7 * 24 * 60 * 60,
    },
  },
};

// ============================================================================
// WORKER FUNCTION
// ============================================================================

/**
 * Process a categorization job
 */
export async function processCategorizationJob(
  job: Job<CategorizationJobData>
): Promise<CategorizationResult> {
  const {
    contractId,
    tenantId,
    forceRecategorize = false,
    autoApply = true,
    autoApplyThreshold = 0.75,
    source = "upload",
  } = job.data;

  const startTime = Date.now();
  const errors: string[] = [];
  const trace = getTraceContextFromJobData(job.data);

  console.log(`🏷️ Starting categorization for contract ${contractId} (traceId=${trace.traceId})`);

  try {
    await job.updateProgress(5);

    await ensureProcessingJob({
      tenantId,
      contractId,
      queueId: job.id ? String(job.id) : undefined,
      traceId: trace.traceId,
    });

    await updateStep({
      tenantId,
      contractId,
      step: 'categorization.run',
      status: 'running',
      progress: 5,
      currentStep: 'categorization.run',
    });

    // Dynamic imports
    const { AIContractCategorizer } = await import("@/lib/ai/contract-categorizer");
    const { prisma } = await import("@/lib/prisma");

    // Get contract
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        rawText: true,
        status: true,
        contractType: true,
        category: true,
        metadata: true,
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    assertRetryableReady({
      status: contract.status,
      message: `Contract status is ${contract.status}, waiting for processing to complete`,
    });

    await job.updateProgress(10);

    const rawTextHash = contract.rawText ? sha256(contract.rawText) : undefined;

    // Idempotency: if we already categorized the same rawText, skip.
    if (!forceRecategorize && rawTextHash) {
      const existingMeta = (contract.metadata as any) ?? {};
      const prevHash = existingMeta?._categorization?.rawTextHash as string | undefined;
      if (prevHash && prevHash === rawTextHash) {
        console.log(`⏭️ Contract ${contractId} categorization unchanged, skipping`);

        await updateStep({
          tenantId,
          contractId,
          step: 'categorization.run',
          status: 'skipped',
          progress: 100,
          currentStep: 'categorization.run',
        });

        return {
          success: true,
          contractId,
          contractType: contract.contractType ?? undefined,
          overallConfidence: 100,
          autoApplied: false,
          processingTimeMs: Date.now() - startTime,
        };
      }
    }

    // Skip if already categorized and not forcing
    if (contract.contractType && contract.category && !forceRecategorize) {
      console.log(`⏭️ Contract ${contractId} already categorized, skipping`);

      await updateStep({
        tenantId,
        contractId,
        step: 'categorization.run',
        status: 'skipped',
        progress: 100,
        currentStep: 'categorization.run',
      });

      return {
        success: true,
        contractId,
        contractType: contract.contractType,
        overallConfidence: 100,
        autoApplied: false,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Check for text
    if (!contract.rawText || contract.rawText.length < 100) {
      throw new RetryableError('Contract has insufficient text for categorization');
    }

    await job.updateProgress(20);

    // Categorize
    const categorizer = new AIContractCategorizer();
    const result = await categorizer.categorize(contract.rawText, {
      contractId,
      model: "gpt-4o-mini",
      includeReasoning: true,
      detectRegulatory: true,
      extractParties: true,
    });

    await job.updateProgress(80);

    // Determine if we should auto-apply
    const shouldAutoApply = autoApply && 
      (result.overallConfidence / 100) >= autoApplyThreshold;

    if (shouldAutoApply) {
      // Map risk level to score
      const riskScoreMap: Record<string, number> = {
        LOW: 20,
        MEDIUM: 50,
        HIGH: 75,
        CRITICAL: 95,
      };

      // Update contract
      const existingMetadata = ((contract.metadata as Record<string, unknown>) || {}) as any;
      
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          contractType: result.contractType.value,
          keywords: result.subjectTags,
          // Store full categorization in metadata JSON field
          metadata: JSON.parse(JSON.stringify({
            ...existingMetadata,
            _categorization: {
              contractType: result.contractType,
              industry: result.industry,
              riskLevel: result.riskLevel,
              complexity: result.complexity,
              regulatoryDomains: result.regulatoryDomains,
              parties: result.parties,
              scope: result.scope,
              flags: result.flags,
              overallConfidence: result.overallConfidence,
              rawTextHash,
              categorizedAt: new Date().toISOString(),
              source,
            },
          })),
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Auto-applied categorization for contract ${contractId}`);
    } else {
      // Store results but don't apply
      const existingMetadata = ((contract.metadata as Record<string, unknown>) || {}) as any;
      
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          metadata: JSON.parse(JSON.stringify({
            ...existingMetadata,
            _pendingCategorization: {
              contractType: result.contractType,
              industry: result.industry,
              riskLevel: result.riskLevel,
              complexity: result.complexity,
              regulatoryDomains: result.regulatoryDomains,
              overallConfidence: result.overallConfidence,
              rawTextHash,
              categorizedAt: new Date().toISOString(),
              needsReview: true,
            },
          })),
        },
      });

      console.log(`⚠️ Categorization needs review for contract ${contractId} (confidence: ${result.overallConfidence}%)`);
    }

    await job.updateProgress(100);

    await updateStep({
      tenantId,
      contractId,
      step: 'categorization.run',
      status: 'completed',
      progress: 100,
      currentStep: 'categorization.run',
    });

    return {
      success: true,
      contractId,
      contractType: result.contractType.value,
      industry: result.industry.value,
      riskLevel: result.riskLevel.value,
      complexity: result.complexity.value,
      overallConfidence: result.overallConfidence,
      autoApplied: shouldAutoApply,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Categorization failed for ${contractId}:`, errorMessage);
    errors.push(errorMessage);

    await updateStep({
      tenantId,
      contractId,
      step: 'categorization.run',
      status: 'failed',
      progress: 100,
      currentStep: 'categorization.run',
      error: errorMessage,
    });

    if (error instanceof Error && error.name === 'RetryableError') {
      throw error;
    }

    return {
      success: false,
      contractId,
      overallConfidence: 0,
      autoApplied: false,
      processingTimeMs: Date.now() - startTime,
      errors,
    };
  }
}

// ============================================================================
// QUEUE HELPERS
// ============================================================================

/**
 * Queue a categorization job
 */
export async function queueCategorizationJob(
  data: CategorizationJobData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
): Promise<string> {
  const { getQueueService } = await import("@repo/utils/queue/queue-service");
  
  const queueService = getQueueService();
  const jobId = options?.jobId || `categorize-${data.contractId}-${Date.now()}`;
  
  await queueService.addJob(
    CATEGORIZATION_QUEUE,
    "categorize-contract",
    data,
    {
      priority: options?.priority ?? (data.priority === "high" ? 1 : data.priority === "low" ? 10 : 5),
      delay: options?.delay,
      jobId,
    }
  );

  console.log(`📥 Queued categorization for contract ${data.contractId}`);
  
  return jobId;
}

/**
 * Queue categorization for multiple contracts
 */
export async function queueBulkCategorization(
  contractIds: string[],
  tenantId: string,
  options?: Partial<CategorizationJobData>
): Promise<string[]> {
  const jobIds: string[] = [];

  for (const contractId of contractIds) {
    const jobId = await queueCategorizationJob({
      contractId,
      tenantId,
      priority: "low",
      source: "bulk",
      ...options,
    });
    jobIds.push(jobId);
  }

  console.log(`📦 Queued ${jobIds.length} categorization jobs`);
  
  return jobIds;
}

// ============================================================================
// WORKER REGISTRATION
// ============================================================================

const logger = pino({
  name: "categorization-worker",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
});

/**
 * Register the categorization worker
 */
export function registerCategorizationWorker(): Worker {
  const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  };

  const worker = new Worker(
    CATEGORIZATION_QUEUE,
    async (job) => {
      logger.info({ jobId: job.id, contractId: job.data.contractId }, "Processing categorization job");
      
      try {
        const result = await processCategorizationJob(job);
        
        logger.info({
          jobId: job.id,
          contractId: job.data.contractId,
          contractType: result.contractType,
          confidence: result.overallConfidence,
          autoApplied: result.autoApplied,
        }, "Categorization completed");
        
        return result;
      } catch (error) {
        logger.error({
          jobId: job.id,
          contractId: job.data.contractId,
          error: error instanceof Error ? error.message : String(error),
        }, "Categorization failed");
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: getWorkerConcurrency('CATEGORIZATION_WORKER_CONCURRENCY', CATEGORIZATION_CONFIG.concurrency),
      limiter: getWorkerLimiter(
        'CATEGORIZATION_WORKER_LIMIT_MAX',
        'CATEGORIZATION_WORKER_LIMIT_DURATION_MS',
        CATEGORIZATION_CONFIG.limiter
      ),
    }
  );

  worker.on("completed", (job, result) => {
    logger.info({ 
      jobId: job.id, 
      contractId: job.data.contractId,
      type: result?.contractType,
    }, "✅ Categorization job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({
      jobId: job?.id,
      contractId: job?.data.contractId,
      error: error.message,
    }, "❌ Categorization job failed");
  });

  worker.on("error", (error) => {
    logger.error({ error: error.message }, "Worker error");
  });

  logger.info("🏷️ Categorization worker registered");
  
  return worker;
}
