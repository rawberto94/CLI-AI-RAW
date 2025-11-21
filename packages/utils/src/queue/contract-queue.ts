import { Job } from 'bullmq';
import { getQueueService } from './queue-service';
import pino from 'pino';

const logger = pino({ name: 'contract-queue' });

export const QUEUE_NAMES = {
  CONTRACT_PROCESSING: 'contract-processing',
  ARTIFACT_GENERATION: 'artifact-generation',
  RAG_INDEXING: 'rag-indexing',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  RATE_CARD_IMPORT: 'rate-card-import',
  BENCHMARK_CALCULATION: 'benchmark-calculation',
} as const;

export const JOB_NAMES = {
  PROCESS_CONTRACT: 'process-contract',
  GENERATE_ARTIFACTS: 'generate-artifacts',
  INDEX_CONTRACT: 'index-contract',
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
}

export interface GenerateArtifactsJobData {
  contractId: string;
  tenantId: string;
  contractText: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface IndexContractJobData {
  contractId: string;
  tenantId: string;
  artifactIds: string[];
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
      progress: job.progress,
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
