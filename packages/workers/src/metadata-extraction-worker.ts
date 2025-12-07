/**
 * Metadata Extraction Worker
 * 
 * Background worker that extracts metadata from contracts using
 * the tenant's custom schema. Runs after OCR and artifact generation.
 * 
 * Features:
 * - Schema-aware extraction using tenant's fields
 * - Confidence scoring and calibration
 * - Analytics tracking
 * - Auto-apply high-confidence values
 * - Queue low-confidence for review
 */

import type { Job } from "bullmq";

// ============================================================================
// TYPES
// ============================================================================

export interface MetadataExtractionJobData {
  contractId: string;
  tenantId: string;
  /** Whether to force re-extraction even if metadata exists */
  forceReExtract?: boolean;
  /** Whether to auto-apply high-confidence values */
  autoApply?: boolean;
  /** Minimum confidence for auto-apply (default 0.85) */
  autoApplyThreshold?: number;
  /** Priority of the extraction */
  priority?: "high" | "normal" | "low";
  /** Source that triggered extraction */
  source?: "upload" | "manual" | "bulk" | "scheduled";
}

export interface MetadataExtractionResult {
  success: boolean;
  contractId: string;
  fieldsExtracted: number;
  fieldsAutoApplied: number;
  fieldsNeedingReview: number;
  fieldsFailed: number;
  averageConfidence: number;
  processingTimeMs: number;
  errors?: string[];
}

// ============================================================================
// WORKER FUNCTION
// ============================================================================

/**
 * Process a metadata extraction job
 */
export async function processMetadataExtractionJob(
  job: Job<MetadataExtractionJobData>
): Promise<MetadataExtractionResult> {
  const {
    contractId,
    tenantId,
    forceReExtract = false,
    autoApply = true,
    autoApplyThreshold = 0.85,
    source = "upload",
  } = job.data;

  const startTime = Date.now();
  const errors: string[] = [];

  console.log(`📊 Starting metadata extraction for contract ${contractId}`);

  try {
    // Update job progress
    await job.updateProgress(5);

    // Dynamic imports to avoid circular dependencies
    const { SchemaAwareMetadataExtractor } = await import("@/lib/ai/metadata-extractor");
    const { getExtractionAnalytics } = await import("@/lib/ai/extraction-analytics");
    const { getCalibrationService } = await import("@/lib/ai/confidence-calibration");
    const { prisma } = await import("@/lib/prisma");

    const analytics = getExtractionAnalytics();
    const calibrationService = getCalibrationService();

    // Record extraction start
    await analytics.recordExtractionStart(contractId, tenantId);
    await job.updateProgress(10);

    // Get the contract to ensure it exists and has text
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        rawText: true,
        status: true,
        contractMetadata: true,
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    if (!contract.rawText || contract.rawText.length < 100) {
      console.log(`⚠️ Contract ${contractId} has insufficient text for extraction`);
      return {
        success: false,
        contractId,
        fieldsExtracted: 0,
        fieldsAutoApplied: 0,
        fieldsNeedingReview: 0,
        fieldsFailed: 0,
        averageConfidence: 0,
        processingTimeMs: Date.now() - startTime,
        errors: ["Insufficient text content for metadata extraction"],
      };
    }

    await job.updateProgress(20);

    // Check if metadata already exists and we're not forcing re-extraction
    const existingMetadata = contract.contractMetadata;
    if (existingMetadata && !forceReExtract) {
      // Check if metadata has values
      const hasValues = Object.values(existingMetadata as object).some(
        (v) => v !== null && v !== undefined && v !== ""
      );
      if (hasValues) {
        console.log(`📋 Contract ${contractId} already has metadata, skipping`);
        return {
          success: true,
          contractId,
          fieldsExtracted: 0,
          fieldsAutoApplied: 0,
          fieldsNeedingReview: 0,
          fieldsFailed: 0,
          averageConfidence: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }
    }

    await job.updateProgress(30);

    // Create extractor and extract metadata
    const extractor = new SchemaAwareMetadataExtractor(tenantId);
    const extractionResult = await extractor.extractMetadata(contractId, forceReExtract);

    await job.updateProgress(70);

    // Process results
    let fieldsAutoApplied = 0;
    let fieldsNeedingReview = 0;
    let fieldsFailed = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    const metadataToApply: Record<string, any> = {};

    for (const field of extractionResult.fields) {
      if (field.value === null) {
        fieldsFailed++;
        continue;
      }

      // Calibrate confidence
      let confidence = field.confidence ?? 0;
      if (confidence > 0) {
        confidence = calibrationService.getAdjustedConfidence(
          field.fieldType,
          confidence
        );
        totalConfidence += confidence;
        confidenceCount++;
      }

      // Decide whether to auto-apply
      if (autoApply && confidence >= autoApplyThreshold) {
        metadataToApply[field.fieldKey] = field.value;
        fieldsAutoApplied++;

        // Record in analytics
        await analytics.recordFieldAutoApplied(
          contractId,
          tenantId,
          field.fieldKey,
          field.fieldType,
          field.value,
          confidence
        );
      } else if (confidence >= 0.4) {
        // Queue for review
        fieldsNeedingReview++;
      } else {
        fieldsFailed++;
      }
    }

    await job.updateProgress(85);

    // Apply auto-approved metadata to contract
    if (Object.keys(metadataToApply).length > 0) {
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          contractMetadata: {
            ...((existingMetadata as object) || {}),
            ...metadataToApply,
            _extractedAt: new Date().toISOString(),
            _extractionSource: source,
          },
        },
      });
      console.log(`✅ Applied ${fieldsAutoApplied} fields to contract ${contractId}`);
    }

    await job.updateProgress(95);

    const processingTimeMs = Date.now() - startTime;
    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    // Record completion in analytics
    await analytics.recordExtractionComplete(
      contractId,
      tenantId,
      extractionResult.fields,
      processingTimeMs,
      "gpt-4o-mini"
    );

    await job.updateProgress(100);

    console.log(
      `📊 Metadata extraction complete for ${contractId}: ` +
        `${fieldsAutoApplied} auto-applied, ${fieldsNeedingReview} need review, ` +
        `${fieldsFailed} failed (avg confidence: ${(averageConfidence * 100).toFixed(1)}%)`
    );

    return {
      success: true,
      contractId,
      fieldsExtracted: extractionResult.fields.length,
      fieldsAutoApplied,
      fieldsNeedingReview,
      fieldsFailed,
      averageConfidence,
      processingTimeMs,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Metadata extraction failed for ${contractId}:`, errorMessage);

    // Record failure in analytics
    try {
      const { getExtractionAnalytics } = await import("@/lib/ai/extraction-analytics");
      await getExtractionAnalytics().recordExtractionFailed(
        contractId,
        tenantId,
        errorMessage,
        Date.now() - startTime
      );
    } catch {
      // Ignore analytics errors
    }

    return {
      success: false,
      contractId,
      fieldsExtracted: 0,
      fieldsAutoApplied: 0,
      fieldsNeedingReview: 0,
      fieldsFailed: 0,
      averageConfidence: 0,
      processingTimeMs: Date.now() - startTime,
      errors: [errorMessage],
    };
  }
}

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

export const METADATA_EXTRACTION_QUEUE = "metadata-extraction";

export const METADATA_EXTRACTION_CONFIG = {
  name: METADATA_EXTRACTION_QUEUE,
  concurrency: 5,
  limiter: {
    max: 30,
    duration: 60000, // 30 per minute
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 60 * 60, // 24 hours
    },
    removeOnFail: {
      count: 500,
      age: 7 * 24 * 60 * 60, // 7 days
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Queue a metadata extraction job
 */
export async function queueMetadataExtractionJob(
  data: MetadataExtractionJobData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
): Promise<string> {
  // Dynamic import to avoid circular dependencies
  const { getQueueService, QUEUE_NAMES } = await import("@/lib/queue-service");
  
  const queueService = getQueueService();
  
  const jobId = options?.jobId || `metadata-${data.contractId}-${Date.now()}`;
  
  await queueService.addJob(
    QUEUE_NAMES.METADATA_EXTRACTION || METADATA_EXTRACTION_QUEUE,
    "extract-metadata",
    data,
    {
      priority: options?.priority ?? (data.priority === "high" ? 1 : data.priority === "low" ? 10 : 5),
      delay: options?.delay,
      jobId,
    }
  );

  console.log(`📥 Queued metadata extraction for contract ${data.contractId}`);
  
  return jobId;
}

/**
 * Queue metadata extraction for multiple contracts
 */
export async function queueBulkMetadataExtraction(
  contractIds: string[],
  tenantId: string,
  options?: Partial<MetadataExtractionJobData>
): Promise<string[]> {
  const jobIds: string[] = [];

  for (const contractId of contractIds) {
    const jobId = await queueMetadataExtractionJob({
      contractId,
      tenantId,
      priority: "low",
      source: "bulk",
      ...options,
    });
    jobIds.push(jobId);
  }

  console.log(`📦 Queued ${jobIds.length} metadata extraction jobs`);
  
  return jobIds;
}

// ============================================================================
// WORKER REGISTRATION
// ============================================================================

import { Worker } from "bullmq";
import pino from "pino";

const logger = pino({
  name: "metadata-extraction-worker",
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
 * Register the metadata extraction worker with BullMQ
 */
export function registerMetadataExtractionWorker(): Worker {
  const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  };

  const worker = new Worker(
    METADATA_EXTRACTION_QUEUE,
    async (job) => {
      logger.info({ jobId: job.id, contractId: job.data.contractId }, "Processing metadata extraction job");
      
      try {
        const result = await processMetadataExtractionJob(job);
        
        logger.info({
          jobId: job.id,
          contractId: job.data.contractId,
          fieldsExtracted: result.fieldsExtracted,
          averageConfidence: result.averageConfidence,
          processingTimeMs: result.processingTimeMs,
        }, "Metadata extraction completed");
        
        return result;
      } catch (error) {
        logger.error({
          jobId: job.id,
          contractId: job.data.contractId,
          error: error instanceof Error ? error.message : String(error),
        }, "Metadata extraction failed");
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: METADATA_EXTRACTION_CONFIG.concurrency,
      limiter: METADATA_EXTRACTION_CONFIG.limiter,
    }
  );

  worker.on("completed", (job, result) => {
    logger.info({ 
      jobId: job.id, 
      contractId: job.data.contractId,
      fieldsExtracted: result?.fieldsExtracted,
    }, "✅ Metadata extraction job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({
      jobId: job?.id,
      contractId: job?.data.contractId,
      error: error.message,
    }, "❌ Metadata extraction job failed");
  });

  worker.on("error", (error) => {
    logger.error({ error: error.message }, "Worker error");
  });

  logger.info("📊 Metadata extraction worker registered");
  
  return worker;
}
