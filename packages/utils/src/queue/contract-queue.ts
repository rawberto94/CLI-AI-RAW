import { getQueueService, JobType } from './queue-service';
import pino from 'pino';

const logger = pino({
  name: 'contract-queue',
  ...(process.env.LOG_LEVEL ? { level: process.env.LOG_LEVEL } : {}),
});

/**
 * Priority levels for queue jobs
 * Lower number = higher priority
 */
export const QUEUE_PRIORITY = {
  URGENT: 1,      // VIP customers, critical contracts
  HIGH: 5,        // Standard interactive processing
  NORMAL: 10,     // Default processing
  LOW: 20,        // Bulk/batch operations
  BACKGROUND: 50, // Non-urgent background tasks
} as const;

export type QueuePriorityLevel = keyof typeof QUEUE_PRIORITY;

export const QUEUE_NAMES = {
  CONTRACT_PROCESSING: 'contract-processing',
  ARTIFACT_GENERATION: 'artifact-generation',
  RAG_INDEXING: 'rag-indexing',
  METADATA_EXTRACTION: 'metadata-extraction',
  CATEGORIZATION: 'contract-categorization',
  AGENT_ORCHESTRATION: 'agent-orchestration',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  RATE_CARD_IMPORT: 'rate-card-import',
  BENCHMARK_CALCULATION: 'benchmark-calculation',
} as const;

export const JOB_NAMES = {
  PROCESS_CONTRACT: 'process-contract',
  GENERATE_ARTIFACTS: 'generate-artifacts',
  INDEX_CONTRACT: 'index-contract',
  EXTRACT_METADATA: 'extract-metadata',
  CATEGORIZE_CONTRACT: 'categorize-contract',
  RUN_AGENT: 'run-agent',
  SEND_WEBHOOK: 'send-webhook',
  IMPORT_RATE_CARDS: 'import-rate-cards',
  CALCULATE_BENCHMARKS: 'calculate-benchmarks',
} as const;

// Job data types
export interface ProcessContractJobData {
  contractId: string;
  tenantId: string;
  filePath: string;
  originalName: string;
  userId?: string;
  ocrMode?: string; // User-selected AI model: 'gpt4', 'mistral', 'auto'
  /** Correlation ID propagated across worker pipeline */
  traceId?: string;
  /** Optional request correlation from API layer */
  requestId?: string;
}

export interface GenerateArtifactsJobData {
  contractId: string;
  tenantId: string;
  contractText: string;
  priority?: 'high' | 'medium' | 'low';
  traceId?: string;
  requestId?: string;
}

export interface IndexContractJobData {
  contractId: string;
  tenantId: string;
  artifactIds: string[];
  traceId?: string;
  requestId?: string;
}

export interface SendWebhookJobData {
  tenantId: string;
  event: string;
  payload: Record<string, any>;
  webhookUrl: string;
  secret?: string;
}

export interface ImportRateCardsJobData {
  importJobId: string;
  tenantId: string;
  filePath: string;
  mappingConfig: Record<string, any>;
}

export interface CalculateBenchmarksJobData {
  tenantId: string;
  serviceCategory?: string;
  roleTitle?: string;
}

export interface MetadataExtractionJobData {
  contractId: string;
  tenantId: string;
  autoApply?: boolean;
  autoApplyThreshold?: number;
  source?: 'upload' | 'manual' | 'reprocess';
  priority?: 'high' | 'normal' | 'low';
  customSchemaId?: string;
  traceId?: string;
  requestId?: string;
}

export interface CategorizationJobData {
  contractId: string;
  tenantId: string;
  forceRecategorize?: boolean;
  autoApply?: boolean;
  autoApplyThreshold?: number;
  priority?: 'high' | 'normal' | 'low';
  source?: 'upload' | 'manual' | 'bulk' | 'scheduled';
  traceId?: string;
  requestId?: string;
}

export interface AgentOrchestrationJobData {
  contractId: string;
  tenantId: string;
  /** Correlation ID propagated across worker pipeline */
  traceId?: string;
  /** Optional request correlation from API layer */
  requestId?: string;
  /** Loop counter for iterative orchestration */
  iteration?: number;
  /** Optional user query for goal-oriented reasoning */
  userQuery?: string;
  /** Optional user role for context-aware processing */
  userRole?: string;
}

/**
 * Contract Queue Manager
 * Handles all contract-related background jobs
 */
export class ContractQueueManager {
  private queueService = getQueueService();

  /**
   * Queue a contract for processing
   */
  public async queueContractProcessing(
    data: ProcessContractJobData,
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<string | null> {
    logger.info({ data, options }, '🔍 queueContractProcessing called with data');
    
    const job = await this.queueService.addJob(
      QUEUE_NAMES.CONTRACT_PROCESSING,
      JOB_NAMES.PROCESS_CONTRACT,
      data,
      {
        priority: options?.priority || 10,
        delay: options?.delay,
        jobId: `contract-${data.contractId}`,
      }
    );

    logger.info({ jobId: job?.id, jobData: job?.data }, '✅ Job created');

    return job?.id || null;
  }

  /**
   * Queue artifact generation
   */
  public async queueArtifactGeneration(
    data: GenerateArtifactsJobData,
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<string | null> {
    const priorityMap = {
      high: 1,
      medium: 5,
      low: 10,
    };

    const job = await this.queueService.addJob(
      QUEUE_NAMES.ARTIFACT_GENERATION,
      JOB_NAMES.GENERATE_ARTIFACTS,
      data,
      {
        priority: options?.priority || priorityMap[data.priority || 'medium'],
        delay: options?.delay,
        jobId: `artifacts-${data.contractId}`,
      }
    );

    return job?.id || null;
  }

  /**
   * Queue RAG indexing
   */
  public async queueRAGIndexing(
    data: IndexContractJobData,
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<string | null> {
    const job = await this.queueService.addJob(
      QUEUE_NAMES.RAG_INDEXING,
      JOB_NAMES.INDEX_CONTRACT,
      data,
      {
        priority: options?.priority || 15,
        delay: options?.delay,
        jobId: `rag-index-${data.contractId}`,
      }
    );

    return job?.id || null;
  }

  /**
   * Queue webhook delivery
   */
  public async queueWebhookDelivery(
    data: SendWebhookJobData,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
    }
  ): Promise<string | null> {
    const job = await this.queueService.addJob(
      QUEUE_NAMES.WEBHOOK_DELIVERY,
      JOB_NAMES.SEND_WEBHOOK,
      data,
      {
        priority: options?.priority || 20,
        delay: options?.delay,
        attempts: options?.attempts || 5,
      }
    );

    return job?.id || null;
  }

  /**
   * Queue rate card import
   */
  public async queueRateCardImport(
    data: ImportRateCardsJobData,
    options?: {
      priority?: number;
    }
  ): Promise<string | null> {
    const job = await this.queueService.addJob(
      QUEUE_NAMES.RATE_CARD_IMPORT,
      JOB_NAMES.IMPORT_RATE_CARDS,
      data,
      {
        priority: options?.priority || 5,
        jobId: `import-${data.importJobId}`,
      }
    );

    return job?.id || null;
  }

  /**
   * Queue benchmark calculation
   */
  public async queueBenchmarkCalculation(
    data: CalculateBenchmarksJobData,
    options?: {
      priority?: number;
    }
  ): Promise<string | null> {
    const job = await this.queueService.addJob(
      QUEUE_NAMES.BENCHMARK_CALCULATION,
      JOB_NAMES.CALCULATE_BENCHMARKS,
      data,
      {
        priority: options?.priority || 25,
        jobId: data.serviceCategory
          ? `benchmark-${data.tenantId}-${data.serviceCategory}`
          : `benchmark-${data.tenantId}-all`,
      }
    );

    return job?.id || null;
  }

  /**
   * Queue metadata extraction
   */
  public async queueMetadataExtraction(
    data: MetadataExtractionJobData,
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<string | null> {
    const priorityMap = {
      high: 5,
      normal: 15,
      low: 25,
    };

    const job = await this.queueService.addJob(
      QUEUE_NAMES.METADATA_EXTRACTION,
      JOB_NAMES.EXTRACT_METADATA,
      data,
      {
        priority: options?.priority || priorityMap[data.priority || 'normal'],
        delay: options?.delay || 2000, // 2 second delay by default
        jobId: `metadata-${data.contractId}`,
      }
    );

    logger.info({ jobId: job?.id, contractId: data.contractId }, '📋 Metadata extraction job queued');

    return job?.id || null;
  }

  /**
   * Queue contract categorization
   */
  public async queueCategorization(
    data: CategorizationJobData,
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<string | null> {
    const priorityMap = {
      high: 5,
      normal: 15,
      low: 25,
    };

    const job = await this.queueService.addJob(
      QUEUE_NAMES.CATEGORIZATION,
      JOB_NAMES.CATEGORIZE_CONTRACT,
      data,
      {
        priority: options?.priority || priorityMap[data.priority || 'normal'],
        delay: options?.delay || 1000, // 1 second delay by default
        jobId: `categorize-${data.contractId}`,
      }
    );

    logger.info({ jobId: job?.id, contractId: data.contractId }, '🏷️ Categorization job queued');

    return job?.id || null;
  }

  /**
   * Queue agent orchestration
   */
  public async queueAgentOrchestration(
    data: AgentOrchestrationJobData,
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<string | null> {
    const job = await this.queueService.addJob(
      QUEUE_NAMES.AGENT_ORCHESTRATION,
      JOB_NAMES.RUN_AGENT,
      data,
      {
        priority: options?.priority || 5,
        delay: options?.delay,
        jobId: `agent-${data.contractId}-${data.iteration || 0}`,
      }
    );

    logger.info({ jobId: job?.id, contractId: data.contractId, iteration: data.iteration }, '🤖 Agent orchestration job queued');

    return job?.id || null;
  }

  /**
   * Get job status
   */
  public async getJobStatus(queueName: string, jobId: string): Promise<{
    state?: string;
    progress?: number;
    data?: any;
    returnvalue?: any;
    failedReason?: string;
    attemptsMade?: number;
  } | null> {
    const job = await this.queueService.getJob(queueName, jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    
    return {
      state,
      progress: typeof job.progress === 'number' ? job.progress : undefined,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
    };
  }

  /**
   * Get queue statistics
   */
  public async getQueueStats(queueName: string) {
    return await this.queueService.getQueueStats(queueName);
  }

  /**
   * Clean old jobs from queue
   */
  public async cleanQueue(
    queueName: string,
    options?: {
      grace?: number;
      limit?: number;
      type?: 'completed' | 'failed';
    }
  ) {
    return await this.queueService.cleanQueue(
      queueName,
      options?.grace,
      options?.limit,
      options?.type
    );
  }
}

// Singleton instance
let contractQueueInstance: ContractQueueManager | null = null;

export function getContractQueue(): ContractQueueManager {
  if (!contractQueueInstance) {
    contractQueueInstance = new ContractQueueManager();
  }
  return contractQueueInstance;
}
