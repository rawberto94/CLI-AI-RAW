"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractQueueManager = exports.JOB_NAMES = exports.QUEUE_NAMES = void 0;
exports.getContractQueue = getContractQueue;
const queue_service_1 = require("./queue-service");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'contract-queue' });
exports.QUEUE_NAMES = {
    CONTRACT_PROCESSING: 'contract-processing',
    ARTIFACT_GENERATION: 'artifact-generation',
    RAG_INDEXING: 'rag-indexing',
    WEBHOOK_DELIVERY: 'webhook-delivery',
    RATE_CARD_IMPORT: 'rate-card-import',
    BENCHMARK_CALCULATION: 'benchmark-calculation',
};
exports.JOB_NAMES = {
    PROCESS_CONTRACT: 'process-contract',
    GENERATE_ARTIFACTS: 'generate-artifacts',
    INDEX_CONTRACT: 'index-contract',
    SEND_WEBHOOK: 'send-webhook',
    IMPORT_RATE_CARDS: 'import-rate-cards',
    CALCULATE_BENCHMARKS: 'calculate-benchmarks',
};
/**
 * Contract Queue Manager
 * Handles all contract-related background jobs
 */
class ContractQueueManager {
    constructor() {
        this.queueService = (0, queue_service_1.getQueueService)();
    }
    /**
     * Queue a contract for processing
     */
    async queueContractProcessing(data, options) {
        const job = await this.queueService.addJob(exports.QUEUE_NAMES.CONTRACT_PROCESSING, exports.JOB_NAMES.PROCESS_CONTRACT, data, {
            priority: options?.priority || 10,
            delay: options?.delay,
            jobId: `contract-${data.contractId}`,
        });
        return job?.id || null;
    }
    /**
     * Queue artifact generation
     */
    async queueArtifactGeneration(data, options) {
        const priorityMap = {
            high: 1,
            medium: 5,
            low: 10,
        };
        const job = await this.queueService.addJob(exports.QUEUE_NAMES.ARTIFACT_GENERATION, exports.JOB_NAMES.GENERATE_ARTIFACTS, data, {
            priority: options?.priority || priorityMap[data.priority || 'medium'],
            delay: options?.delay,
            jobId: `artifacts-${data.contractId}`,
        });
        return job?.id || null;
    }
    /**
     * Queue RAG indexing
     */
    async queueRAGIndexing(data, options) {
        const job = await this.queueService.addJob(exports.QUEUE_NAMES.RAG_INDEXING, exports.JOB_NAMES.INDEX_CONTRACT, data, {
            priority: options?.priority || 15,
            delay: options?.delay,
            jobId: `rag-index-${data.contractId}`,
        });
        return job?.id || null;
    }
    /**
     * Queue webhook delivery
     */
    async queueWebhookDelivery(data, options) {
        const job = await this.queueService.addJob(exports.QUEUE_NAMES.WEBHOOK_DELIVERY, exports.JOB_NAMES.SEND_WEBHOOK, data, {
            priority: options?.priority || 20,
            delay: options?.delay,
            attempts: options?.attempts || 5,
        });
        return job?.id || null;
    }
    /**
     * Queue rate card import
     */
    async queueRateCardImport(data, options) {
        const job = await this.queueService.addJob(exports.QUEUE_NAMES.RATE_CARD_IMPORT, exports.JOB_NAMES.IMPORT_RATE_CARDS, data, {
            priority: options?.priority || 5,
            jobId: `import-${data.importJobId}`,
        });
        return job?.id || null;
    }
    /**
     * Queue benchmark calculation
     */
    async queueBenchmarkCalculation(data, options) {
        const job = await this.queueService.addJob(exports.QUEUE_NAMES.BENCHMARK_CALCULATION, exports.JOB_NAMES.CALCULATE_BENCHMARKS, data, {
            priority: options?.priority || 25,
            jobId: data.serviceCategory
                ? `benchmark-${data.tenantId}-${data.serviceCategory}`
                : `benchmark-${data.tenantId}-all`,
        });
        return job?.id || null;
    }
    /**
     * Get job status
     */
    async getJobStatus(queueName, jobId) {
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
    async getQueueStats(queueName) {
        return await this.queueService.getQueueStats(queueName);
    }
    /**
     * Clean old jobs from queue
     */
    async cleanQueue(queueName, options) {
        return await this.queueService.cleanQueue(queueName, options?.grace, options?.limit, options?.type);
    }
}
exports.ContractQueueManager = ContractQueueManager;
// Singleton instance
let contractQueueInstance = null;
function getContractQueue() {
    if (!contractQueueInstance) {
        contractQueueInstance = new ContractQueueManager();
    }
    return contractQueueInstance;
}
