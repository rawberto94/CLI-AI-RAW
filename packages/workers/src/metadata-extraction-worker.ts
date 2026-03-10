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

// Use any for Job type due to cross-package compatibility
type Job<T = any> = { id?: string; name: string; data: T; attemptsMade: number; opts: any; updateProgress: (progress: number | object) => Promise<void> };

import { getTraceContextFromJobData } from './observability/trace';
import { ensureProcessingJob, updateStep, assertRetryableReady } from './workflow/processing-job';
import { RetryableError } from './utils/errors';
import { sha256 } from './utils/hash';
import { getWorkerConcurrency, getWorkerLimiter } from './config/worker-runtime';

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
  /** Correlation ID propagated across worker pipeline */
  traceId?: string;
  /** Optional request correlation from API layer */
  requestId?: string;
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
  const trace = getTraceContextFromJobData(job.data);

  try {
    // Update job progress
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
      step: 'metadata.extract',
      status: 'running',
      progress: 5,
      currentStep: 'metadata.extract',
    });

    // Dynamic imports to avoid circular dependencies
    const { SchemaAwareMetadataExtractor } = await import("@/lib/ai/metadata-extractor");
    const { MetadataSchemaService } = await import("@/lib/services/metadata-schema.service");
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
        contractMetadata: { select: { customFields: true } },
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // If OCR/processing hasn’t completed yet, retry instead of returning a permanent failure.
    assertRetryableReady({
      status: contract.status,
      message: `Contract status is ${contract.status}, waiting for processing to complete`,
    });

    if (!contract.rawText || contract.rawText.length < 100) {
      throw new RetryableError('Insufficient text content for metadata extraction');
    }

    await job.updateProgress(20);

    const rawTextHash = sha256(contract.rawText);

    // Check if extraction results already exist and we're not forcing re-extraction
    const existingCustomFields = (contract.contractMetadata as any)?.customFields as any;
    if (existingCustomFields && !forceReExtract) {
      const hasPriorExtraction = typeof existingCustomFields === 'object' && !!existingCustomFields?._aiExtraction;
      const priorHash = existingCustomFields?._aiExtraction?.lastExtraction?.rawTextHash as string | undefined;
      if (hasPriorExtraction && (!priorHash || priorHash === rawTextHash)) {

        await updateStep({
          tenantId,
          contractId,
          step: 'metadata.extract',
          status: 'skipped',
          progress: 100,
          currentStep: 'metadata.extract',
        });

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

    // Load schema and extract metadata
    const schemaService = MetadataSchemaService.getInstance();
    const schema = await schemaService.getSchema(tenantId);

    const extractor = new SchemaAwareMetadataExtractor();
    const extractionResult = await Promise.race([
      extractor.extractMetadata(contract.rawText, schema, {
        enableMultiPass: true,
        maxPasses: 2,
        confidenceThreshold: 0.7,
        includeAlternatives: true,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Metadata extraction timeout (120s)')), 120_000)),
    ]);

    await job.updateProgress(70);

    // Process results
    let fieldsAutoApplied = 0;
    let fieldsNeedingReview = 0;
    let fieldsFailed = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    const metadataToApply: Record<string, any> = {};

    const existingCustom = (existingCustomFields && typeof existingCustomFields === 'object')
      ? existingCustomFields
      : {};

    for (const result of extractionResult.results) {
      if (result.value === null || result.value === undefined) {
        fieldsFailed++;
        continue;
      }

      // Calibrate confidence
      let confidence = result.confidence ?? 0;
      if (confidence > 0) {
        const calibrated = calibrationService.calibrateConfidence(
          tenantId,
          result.fieldName,
          confidence
        );
        confidence = calibrated.calibratedConfidence;
        totalConfidence += confidence;
        confidenceCount++;
      }

      const perFieldThreshold = (schema.fields.find((f: any) => f.id === result.fieldId)?.aiConfidenceThreshold) ?? 0;
      const threshold = Math.max(autoApplyThreshold, perFieldThreshold);

      // Decide whether to auto-apply
      if (autoApply && confidence >= threshold) {
        metadataToApply[result.fieldName] = result.value;
        fieldsAutoApplied++;

        // Record in analytics
        await analytics.recordFieldAutoApplied(
          contractId,
          tenantId,
          result.fieldName,
          result.fieldType,
          result.value,
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

    const extractionData = {
      lastExtraction: {
        extractedAt: extractionResult.extractedAt,
        schemaId: extractionResult.schemaId,
        schemaVersion: extractionResult.schemaVersion,
        rawTextHash,
        summary: extractionResult.summary,
        warnings: extractionResult.warnings,
        source,
      },
      extractedFields: extractionResult.rawExtractions,
      fieldDetails: extractionResult.results.reduce((acc: any, r: any) => ({
        ...acc,
        [r.fieldName]: {
          value: r.value,
          confidence: r.confidence,
          validationStatus: r.validationStatus,
          requiresReview: r.requiresHumanReview,
          source: r.source?.text?.slice(0, 200),
        }
      }), {}),
    };

    const appliedAt = new Date();
    const mergedCustomFields = {
      ...existingCustom,
      ...(Object.keys(metadataToApply).length > 0 ? metadataToApply : {}),
      _aiExtraction: extractionData,
      _metadata: {
        ...(existingCustom?._metadata || {}),
        appliedAt: appliedAt.toISOString(),
        appliedBy: 'metadata-extraction-worker',
        fieldCount: Object.keys(metadataToApply).length,
        validated: false,
      },
    };

    const contractUpdates: Record<string, any> = {};
    if (typeof metadataToApply.contract_title === 'string') contractUpdates.contractTitle = metadataToApply.contract_title;
    if (typeof metadataToApply.client_name === 'string') contractUpdates.clientName = metadataToApply.client_name;
    if (typeof metadataToApply.supplier_name === 'string') contractUpdates.supplierName = metadataToApply.supplier_name;
    if (typeof metadataToApply.contract_type === 'string') contractUpdates.contractType = metadataToApply.contract_type;
    if (metadataToApply.total_value !== undefined && metadataToApply.total_value !== null && !Number.isNaN(Number(metadataToApply.total_value))) {
      contractUpdates.totalValue = Number(metadataToApply.total_value);
    }
    if (typeof metadataToApply.currency === 'string') contractUpdates.currency = metadataToApply.currency;
    if (typeof metadataToApply.payment_terms === 'string') contractUpdates.paymentTerms = metadataToApply.payment_terms;
    if (typeof metadataToApply.jurisdiction === 'string') contractUpdates.jurisdiction = metadataToApply.jurisdiction;
    if (typeof metadataToApply.effective_date === 'string' || metadataToApply.effective_date instanceof Date) {
      const d = new Date(metadataToApply.effective_date);
      if (!Number.isNaN(d.getTime())) contractUpdates.effectiveDate = d;
    }
    if (typeof metadataToApply.expiration_date === 'string' || metadataToApply.expiration_date instanceof Date) {
      const d = new Date(metadataToApply.expiration_date);
      if (!Number.isNaN(d.getTime())) contractUpdates.expirationDate = d;
    }
    if (typeof metadataToApply.notice_period === 'number' && Number.isFinite(metadataToApply.notice_period)) {
      contractUpdates.noticePeriodDays = Math.max(0, Math.round(metadataToApply.notice_period));
    }
    if (typeof metadataToApply.auto_renewal === 'boolean') {
      contractUpdates.autoRenewalEnabled = metadataToApply.auto_renewal;
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.contractMetadata.upsert({
        where: { contractId },
        update: {
          customFields: mergedCustomFields,
          lastUpdated: appliedAt,
          updatedBy: 'metadata-extraction-worker',
        },
        create: {
          contractId,
          tenantId,
          customFields: mergedCustomFields,
          systemFields: {},
          tags: [],
          lastUpdated: appliedAt,
          updatedBy: 'metadata-extraction-worker',
        },
      });

      if (Object.keys(contractUpdates).length > 0) {
        await tx.contract.update({
          where: { id: contractId },
          data: contractUpdates,
        });
      }
    });

    if (Object.keys(metadataToApply).length > 0) {
      // Auto-applied fields to contract
    }

    await job.updateProgress(95);

    const processingTimeMs = Date.now() - startTime;
    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    // Record completion in analytics
    // Map extractionResult.results to ExtractedField format
    const extractedFields = extractionResult.results.map((r: any) => ({
      fieldKey: r.key || r.fieldKey || r.name || '',
      value: r.value,
      confidence: r.confidence ?? 0,
      fieldType: r.type || r.fieldType,
    }));
    
    await analytics.recordExtractionComplete(
      contractId,
      tenantId,
      extractedFields,
      processingTimeMs,
      "gpt-4o-mini"
    );

    await job.updateProgress(100);

    await updateStep({
      tenantId,
      contractId,
      step: 'metadata.extract',
      status: 'completed',
      progress: 100,
      currentStep: 'metadata.extract',
    });

    return {
      success: true,
      contractId,
      fieldsExtracted: extractionResult.results.length,
      fieldsAutoApplied,
      fieldsNeedingReview,
      fieldsFailed,
      averageConfidence,
      processingTimeMs,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await updateStep({
      tenantId,
      contractId,
      step: 'metadata.extract',
      status: 'failed',
      progress: 100,
      currentStep: 'metadata.extract',
      error: errorMessage,
    });

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

    // Let BullMQ retry/backoff on retryable conditions.
    if (error instanceof Error && error.name === 'RetryableError') {
      throw error;
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
  const { getQueueService } = await import("@repo/utils/queue/queue-service");
  const { QUEUE_NAMES } = await import("@repo/utils/queue/contract-queue");
  
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
    host: process.env.REDIS_HOST,
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
      concurrency: getWorkerConcurrency('METADATA_WORKER_CONCURRENCY', METADATA_EXTRACTION_CONFIG.concurrency),
      limiter: getWorkerLimiter(
        'METADATA_WORKER_LIMIT_MAX',
        'METADATA_WORKER_LIMIT_DURATION_MS',
        METADATA_EXTRACTION_CONFIG.limiter
      ),
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
