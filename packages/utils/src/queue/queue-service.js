"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
exports.getQueueService = getQueueService;
exports.resetQueueService = resetQueueService;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    name: 'queue-service',
    ...(process.env.LOG_LEVEL ? { level: process.env.LOG_LEVEL } : {}),
});
/**
 * Queue Service for managing background jobs with BullMQ
 * Provides unified interface for job queuing, processing, and monitoring
 */
class QueueService {
    queues = new Map();
    workers = new Map();
    queueEvents = new Map();
    connection;
    redisClient;
    constructor(config) {
        this.connection = config.connection;
        // Test Redis connection
        this.testConnection();
    }
    async testConnection() {
        try {
            this.redisClient = new ioredis_1.default(this.connection);
            await this.redisClient.ping();
            logger.info('✅ Queue service connected to Redis');
        }
        catch (error) {
            logger.error({ error }, '❌ Failed to connect to Redis for queue service');
            // Don't throw - allow graceful degradation
        }
    }
    /**
     * Create or get a queue
     */
    getQueue(queueName, options) {
        if (!this.queues.has(queueName)) {
            const queue = new bullmq_1.Queue(queueName, {
                connection: this.connection,
                defaultJobOptions: options?.defaultJobOptions || {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                    removeOnComplete: 100, // Keep last 100 completed jobs
                    removeOnFail: 500, // Keep last 500 failed jobs
                },
            });
            this.queues.set(queueName, queue);
            logger.info({ queueName }, 'Queue created');
        }
        return this.queues.get(queueName);
    }
    /**
     * Add a job to the queue
     */
    async addJob(queueName, jobName, data, options) {
        try {
            const queue = this.getQueue(queueName);
            const job = await queue.add(jobName, data, {
                priority: options?.priority,
                delay: options?.delay,
                attempts: options?.attempts,
                jobId: options?.jobId,
            });
            logger.info({
                queueName,
                jobName,
                jobId: job.id,
                priority: options?.priority,
            }, 'Job added to queue');
            return job;
        }
        catch (error) {
            logger.error({ error, queueName, jobName }, 'Failed to add job to queue');
            return null;
        }
    }
    /**
     * Register a worker to process jobs
     */
    registerWorker(queueName, processor, options) {
        if (this.workers.has(queueName)) {
            logger.warn({ queueName }, 'Worker already registered for queue');
            return this.workers.get(queueName);
        }
        const worker = new bullmq_1.Worker(queueName, async (job) => {
            logger.info({
                queueName,
                jobId: job.id,
                jobName: job.name,
                attemptsMade: job.attemptsMade,
            }, 'Processing job');
            try {
                const result = await processor(job);
                logger.info({
                    queueName,
                    jobId: job.id,
                    jobName: job.name,
                }, 'Job completed successfully');
                return result;
            }
            catch (error) {
                logger.error({
                    error,
                    queueName,
                    jobId: job.id,
                    jobName: job.name,
                    attemptsMade: job.attemptsMade,
                }, 'Job processing failed');
                throw error;
            }
        }, {
            connection: this.connection,
            concurrency: options?.concurrency || 5,
            limiter: options?.limiter,
        });
        // Handle worker events
        worker.on('completed', (job) => {
            logger.debug({
                queueName,
                jobId: job.id,
                returnvalue: job.returnvalue,
            }, 'Worker completed job');
        });
        worker.on('failed', (job, error) => {
            logger.error({
                queueName,
                jobId: job?.id,
                error,
                attemptsMade: job?.attemptsMade,
            }, 'Worker failed to process job');
        });
        worker.on('error', (error) => {
            logger.error({ queueName, error }, 'Worker error');
        });
        this.workers.set(queueName, worker);
        logger.info({ queueName, concurrency: options?.concurrency }, 'Worker registered');
        return worker;
    }
    /**
     * Get queue events for monitoring
     */
    getQueueEvents(queueName) {
        if (!this.queueEvents.has(queueName)) {
            const queueEvents = new bullmq_1.QueueEvents(queueName, {
                connection: this.connection,
            });
            this.queueEvents.set(queueName, queueEvents);
            logger.info({ queueName }, 'Queue events listener created');
        }
        return this.queueEvents.get(queueName);
    }
    /**
     * Get queue statistics
     */
    async getQueueStats(queueName) {
        const queue = this.getQueue(queueName);
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);
        // Check if queue is paused
        const isPaused = await queue.isPaused();
        return { waiting, active, completed, failed, delayed, paused: isPaused ? 1 : 0 };
    }
    /**
     * Get job by ID
     */
    async getJob(queueName, jobId) {
        const queue = this.getQueue(queueName);
        const job = await queue.getJob(jobId);
        return job ?? null;
    }
    /**
     * Remove a job
     */
    async removeJob(queueName, jobId) {
        const job = await this.getJob(queueName, jobId);
        if (job) {
            await job.remove();
            logger.info({ queueName, jobId }, 'Job removed');
        }
    }
    /**
     * Add a job that depends on another job completing successfully
     * Uses BullMQ's native job dependencies feature
     */
    async addDependentJob(queueName, jobName, data, parentJob, options) {
        try {
            const queue = this.getQueue(queueName);
            const job = await queue.add(jobName, data, {
                priority: options?.priority,
                attempts: options?.attempts,
                jobId: options?.jobId,
                parent: {
                    queue: parentJob.queue,
                    id: parentJob.id,
                },
            });
            logger.info({
                queueName,
                jobName,
                jobId: job.id,
                parentQueue: parentJob.queue,
                parentJobId: parentJob.id,
            }, 'Dependent job added to queue');
            return job;
        }
        catch (error) {
            logger.error({ error, queueName, jobName }, 'Failed to add dependent job to queue');
            return null;
        }
    }
    /**
     * Add multiple jobs that will execute after a parent job completes
     * This is a simpler approach using event-based triggering
     */
    async addChildJobs(parentQueue, parentJobId, children) {
        // Get parent job
        const parentJob = await this.getJob(parentQueue, parentJobId);
        if (!parentJob) {
            logger.warn({ parentQueue, parentJobId }, 'Parent job not found for child jobs');
            return;
        }
        // Listen for parent completion and add children
        const queueEvents = this.getQueueEvents(parentQueue);
        const completedHandler = async (args) => {
            if (args.jobId === parentJobId) {
                logger.info({ parentJobId, childCount: children.length }, 'Parent job completed, adding child jobs');
                for (const child of children) {
                    await this.addJob(child.queue, child.name, child.data, {
                        priority: child.options?.priority,
                        delay: child.options?.delay || 0,
                    });
                }
                // Remove listener after use
                queueEvents.off('completed', completedHandler);
            }
        };
        queueEvents.on('completed', completedHandler);
    }
    /**
     * Pause a queue
     */
    async pauseQueue(queueName) {
        const queue = this.getQueue(queueName);
        await queue.pause();
        logger.info({ queueName }, 'Queue paused');
    }
    /**
     * Resume a queue
     */
    async resumeQueue(queueName) {
        const queue = this.getQueue(queueName);
        await queue.resume();
        logger.info({ queueName }, 'Queue resumed');
    }
    /**
     * Clean up completed/failed jobs
     */
    async cleanQueue(queueName, grace = 3600000, // 1 hour
    limit = 1000, type = 'completed') {
        const queue = this.getQueue(queueName);
        const jobs = await queue.clean(grace, limit, type);
        logger.info({ queueName, count: jobs.length, type }, 'Queue cleaned');
        return jobs;
    }
    /**
     * Graceful shutdown
     */
    async close() {
        logger.info('Closing queue service...');
        // Close workers
        await Promise.all(Array.from(this.workers.values()).map((worker) => worker.close()));
        // Close queue events
        await Promise.all(Array.from(this.queueEvents.values()).map((qe) => qe.close()));
        // Close queues
        await Promise.all(Array.from(this.queues.values()).map((queue) => queue.close()));
        // Close Redis client
        if (this.redisClient) {
            await this.redisClient.quit();
        }
        logger.info('Queue service closed');
    }
}
exports.QueueService = QueueService;
// Singleton instance
let queueServiceInstance = null;
function getQueueService(config) {
    if (!queueServiceInstance && config) {
        queueServiceInstance = new QueueService(config);
    }
    if (!queueServiceInstance) {
        throw new Error('QueueService not initialized. Call getQueueService(config) first.');
    }
    return queueServiceInstance;
}
function resetQueueService() {
    queueServiceInstance = null;
}
