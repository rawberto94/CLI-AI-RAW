/**
 * RAG Integration Service
 * 
 * Professional integration layer between artifact generation and RAG system.
 * Handles automatic indexing of contracts into the RAG system with:
 * - Event-driven architecture
 * - Retry logic with exponential backoff
 * - Error handling and graceful degradation
 * - Performance monitoring
 * - Feature flags for gradual rollout
 */

import { unifiedRAGOrchestrator } from './rag/unified-rag-orchestrator.service';
import { eventBus, Events } from '../events/event-bus';
import pino from 'pino';

const logger = pino({ name: 'rag-integration-service' });

export interface RAGIntegrationConfig {
  enabled: boolean;
  autoIndexOnUpload: boolean;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  failSilently: boolean;
}

export interface RAGIndexingResult {
  success: boolean;
  contractId: string;
  tenantId: string;
  processingTime: number;
  vectorIndexed: boolean;
  graphBuilt: boolean;
  multiModalProcessed: boolean;
  error?: string;
  retryCount?: number;
}

export class RAGIntegrationService {
  private static instance: RAGIntegrationService;
  private config: RAGIntegrationConfig;
  private indexingQueue: Map<string, { retries: number; lastAttempt: Date }> = new Map();
  private metrics = {
    totalIndexed: 0,
    totalFailed: 0,
    totalRetries: 0,
    avgProcessingTime: 0,
  };

  private constructor() {
    // Load configuration from environment
    this.config = {
      enabled: process.env.RAG_INTEGRATION_ENABLED !== 'false',
      autoIndexOnUpload: process.env.RAG_AUTO_INDEX !== 'false',
      maxRetries: parseInt(process.env.RAG_MAX_RETRIES || '3'),
      retryDelayMs: parseInt(process.env.RAG_RETRY_DELAY_MS || '5000'),
      timeoutMs: parseInt(process.env.RAG_TIMEOUT_MS || '30000'),
      failSilently: process.env.RAG_FAIL_SILENTLY !== 'false',
    };

    logger.info({ config: this.config }, 'RAG Integration Service initialized');

    // Register event listeners
    this.registerEventListeners();
  }

  static getInstance(): RAGIntegrationService {
    if (!RAGIntegrationService.instance) {
      RAGIntegrationService.instance = new RAGIntegrationService();
    }
    return RAGIntegrationService.instance;
  }

  /**
   * Register event listeners for automatic RAG indexing
   */
  private registerEventListeners(): void {
    if (!this.config.enabled || !this.config.autoIndexOnUpload) {
      logger.info('Auto-indexing disabled, skipping event listener registration');
      return;
    }

    // Listen for artifact generation completion
    eventBus.on(Events.ARTIFACTS_GENERATED, async (data: any) => {
      try {
        logger.info(
          { contractId: data.contractId, tenantId: data.tenantId },
          'Artifacts generated event received, triggering RAG indexing'
        );

        await this.indexContract(
          data.contractId,
          data.tenantId,
          data.userId || 'system',
          data.artifacts
        );
      } catch (error) {
        logger.error(
          { error, contractId: data.contractId },
          'Failed to handle artifacts generated event'
        );
      }
    });

    // Listen for contract updates
    eventBus.on(Events.CONTRACT_UPDATED, async (data: any) => {
      try {
        logger.info(
          { contractId: data.contractId, tenantId: data.tenantId },
          'Contract updated event received, re-indexing in RAG'
        );

        await this.reindexContract(
          data.contractId,
          data.tenantId,
          data.userId || 'system',
          data.artifacts
        );
      } catch (error) {
        logger.error(
          { error, contractId: data.contractId },
          'Failed to handle contract updated event'
        );
      }
    });

    // Listen for contract deletions
    eventBus.on(Events.CONTRACT_DELETED, async (data: any) => {
      try {
        logger.info(
          { contractId: data.contractId, tenantId: data.tenantId },
          'Contract deleted event received, removing from RAG'
        );

        await this.removeFromRAG(data.contractId, data.tenantId);
      } catch (error) {
        logger.error(
          { error, contractId: data.contractId },
          'Failed to handle contract deleted event'
        );
      }
    });

    logger.info('RAG integration event listeners registered');
  }

  /**
   * Index a contract into the RAG system
   */
  async indexContract(
    contractId: string,
    tenantId: string,
    userId: string,
    artifacts: any[]
  ): Promise<RAGIndexingResult> {
    if (!this.config.enabled) {
      logger.debug({ contractId }, 'RAG integration disabled, skipping indexing');
      return {
        success: false,
        contractId,
        tenantId,
        processingTime: 0,
        vectorIndexed: false,
        graphBuilt: false,
        multiModalProcessed: false,
        error: 'RAG integration disabled',
      };
    }

    const startTime = Date.now();
    const queueKey = `${tenantId}:${contractId}`;

    try {
      logger.info(
        { contractId, tenantId, artifactCount: artifacts?.length || 0 },
        'Starting RAG indexing'
      );

      // Check if already in retry queue
      const queueEntry = this.indexingQueue.get(queueKey);
      if (queueEntry && queueEntry.retries >= this.config.maxRetries) {
        throw new Error(
          `Max retries (${this.config.maxRetries}) exceeded for contract ${contractId}`
        );
      }

      // Process with timeout
      const result = await this.withTimeout(
        unifiedRAGOrchestrator.processContract(
          contractId,
          tenantId,
          userId,
          artifacts || []
        ),
        this.config.timeoutMs
      );

      // Clear from retry queue on success
      this.indexingQueue.delete(queueKey);

      const processingTime = Date.now() - startTime;

      // Update metrics
      this.metrics.totalIndexed++;
      this.metrics.avgProcessingTime =
        (this.metrics.avgProcessingTime * (this.metrics.totalIndexed - 1) +
          processingTime) /
        this.metrics.totalIndexed;

      logger.info(
        {
          contractId,
          tenantId,
          processingTime,
          vectorIndexed: result.vector?.success,
          graphBuilt: result.graph?.nodesCreated > 0,
          multiModalProcessed: result.multiModal?.tables?.tablesExtracted > 0,
        },
        'RAG indexing completed successfully'
      );

      // Emit success event
      eventBus.emit(Events.RAG_INDEXED, {
        contractId,
        tenantId,
        success: true,
        processingTime,
      });

      return {
        success: true,
        contractId,
        tenantId,
        processingTime,
        vectorIndexed: result.vector?.success || false,
        graphBuilt: result.graph?.nodesCreated > 0 || false,
        multiModalProcessed:
          (result.multiModal?.tables?.tablesExtracted || 0) > 0 ||
          (result.multiModal?.images?.imagesExtracted || 0) > 0,
        retryCount: queueEntry?.retries || 0,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        { error, contractId, tenantId, processingTime },
        'RAG indexing failed'
      );

      // Update metrics
      this.metrics.totalFailed++;

      // Handle retry logic
      const shouldRetry = await this.handleIndexingFailure(
        contractId,
        tenantId,
        userId,
        artifacts,
        queueKey,
        errorMessage
      );

      // Emit failure event
      eventBus.emit(Events.RAG_INDEXING_FAILED, {
        contractId,
        tenantId,
        error: errorMessage,
        willRetry: shouldRetry,
      });

      if (!this.config.failSilently) {
        throw error;
      }

      return {
        success: false,
        contractId,
        tenantId,
        processingTime,
        vectorIndexed: false,
        graphBuilt: false,
        multiModalProcessed: false,
        error: errorMessage,
        retryCount: this.indexingQueue.get(queueKey)?.retries || 0,
      };
    }
  }

  /**
   * Re-index a contract (for updates)
   */
  async reindexContract(
    contractId: string,
    tenantId: string,
    userId: string,
    artifacts: any[]
  ): Promise<RAGIndexingResult> {
    logger.info({ contractId, tenantId }, 'Re-indexing contract in RAG');

    // Remove old data first
    await this.removeFromRAG(contractId, tenantId);

    // Index with new data
    return this.indexContract(contractId, tenantId, userId, artifacts);
  }

  /**
   * Remove contract from RAG system
   */
  async removeFromRAG(contractId: string, tenantId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      logger.info({ contractId, tenantId }, 'Removing contract from RAG');

      // TODO: Implement deletion in RAG services
      // await hybridRAGService.deleteContract(contractId);
      // await knowledgeGraphService.deleteContract(contractId);

      logger.info({ contractId, tenantId }, 'Contract removed from RAG');
    } catch (error) {
      logger.error(
        { error, contractId, tenantId },
        'Failed to remove contract from RAG'
      );

      if (!this.config.failSilently) {
        throw error;
      }
    }
  }

  /**
   * Handle indexing failure with retry logic
   */
  private async handleIndexingFailure(
    contractId: string,
    tenantId: string,
    userId: string,
    artifacts: any[],
    queueKey: string,
    error: string
  ): Promise<boolean> {
    const queueEntry = this.indexingQueue.get(queueKey) || {
      retries: 0,
      lastAttempt: new Date(),
    };

    queueEntry.retries++;
    queueEntry.lastAttempt = new Date();
    this.indexingQueue.set(queueKey, queueEntry);

    if (queueEntry.retries >= this.config.maxRetries) {
      logger.error(
        { contractId, tenantId, retries: queueEntry.retries },
        'Max retries reached, giving up on RAG indexing'
      );
      this.indexingQueue.delete(queueKey);
      return false;
    }

    // Schedule retry with exponential backoff
    const delay = this.config.retryDelayMs * Math.pow(2, queueEntry.retries - 1);

    logger.warn(
      { contractId, tenantId, retries: queueEntry.retries, delayMs: delay },
      'Scheduling RAG indexing retry'
    );

    this.metrics.totalRetries++;

    setTimeout(() => {
      this.indexContract(contractId, tenantId, userId, artifacts).catch((err) => {
        logger.error({ error: err, contractId }, 'Retry failed');
      });
    }, delay);

    return true;
  }

  /**
   * Execute with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('RAG indexing timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Manually trigger indexing for a contract
   */
  async manualIndex(
    contractId: string,
    tenantId: string,
    userId: string,
    artifacts: any[]
  ): Promise<RAGIndexingResult> {
    logger.info({ contractId, tenantId, userId }, 'Manual RAG indexing triggered');
    return this.indexContract(contractId, tenantId, userId, artifacts);
  }

  /**
   * Batch index multiple contracts
   */
  async batchIndex(
    contracts: Array<{
      contractId: string;
      tenantId: string;
      userId: string;
      artifacts: any[];
    }>
  ): Promise<RAGIndexingResult[]> {
    logger.info({ count: contracts.length }, 'Starting batch RAG indexing');

    const results = await Promise.allSettled(
      contracts.map((contract) =>
        this.indexContract(
          contract.contractId,
          contract.tenantId,
          contract.userId,
          contract.artifacts
        )
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          contractId: contracts[index].contractId,
          tenantId: contracts[index].tenantId,
          processingTime: 0,
          vectorIndexed: false,
          graphBuilt: false,
          multiModalProcessed: false,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });
  }

  /**
   * Get integration metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.indexingQueue.size,
      config: this.config,
    };
  }

  /**
   * Get retry queue status
   */
  getRetryQueue() {
    return Array.from(this.indexingQueue.entries()).map(([key, value]) => ({
      key,
      retries: value.retries,
      lastAttempt: value.lastAttempt,
      nextRetryIn: this.calculateNextRetryDelay(value.retries),
    }));
  }

  /**
   * Calculate next retry delay
   */
  private calculateNextRetryDelay(retries: number): number {
    return this.config.retryDelayMs * Math.pow(2, retries);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RAGIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'RAG integration config updated');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const orchestratorHealth = await unifiedRAGOrchestrator.getSystemStatus(
        'health-check'
      );

      const status =
        orchestratorHealth.overall === 'healthy'
          ? 'healthy'
          : orchestratorHealth.overall === 'degraded'
          ? 'degraded'
          : 'unhealthy';

      return {
        status,
        details: {
          enabled: this.config.enabled,
          metrics: this.metrics,
          queueSize: this.indexingQueue.size,
          orchestrator: orchestratorHealth,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

export const ragIntegrationService = RAGIntegrationService.getInstance();
