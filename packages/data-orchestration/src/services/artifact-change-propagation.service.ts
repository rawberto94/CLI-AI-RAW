/**
 * Artifact Change Propagation Service
 * 
 * Handles propagation of artifact changes to all dependent analytical engines:
 * - Rate Card Benchmarking Engine
 * - Renewal Radar Engine
 * - Compliance Engine
 * - Supplier Snapshot Engine
 * - Spend Overlay Engine
 * - Cost Savings Analysis
 * 
 * Also updates search indexes and RAG knowledge base
 */

import { eventBus, Events } from '../events/event-bus';
import pino from 'pino';

const logger = pino({ name: 'artifact-change-propagation-service' });

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface ArtifactChangeEvent {
  artifactId: string;
  contractId: string;
  tenantId: string;
  artifactType: string;
  changeType: string;
  changes: any[];
  userId: string;
  data?: any;
}

export interface AnalyticalEngine {
  name: string;
  notifyMethod: (contractId: string, artifactType: string, data?: any) => Promise<void>;
}

export interface PropagationResult {
  engine: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: Date;
  error?: string;
  recalculatedItems: string[];
}

// =========================================================================
// ARTIFACT CHANGE PROPAGATION SERVICE
// =========================================================================

export class ArtifactChangePropagationService {
  private static instance: ArtifactChangePropagationService;
  private retryQueue: Map<string, { event: ArtifactChangeEvent; retryCount: number }> = new Map();
  private maxRetries = 3;

  private constructor() {
    logger.info('Artifact Change Propagation Service initialized');
    this.setupEventListeners();
  }

  static getInstance(): ArtifactChangePropagationService {
    if (!ArtifactChangePropagationService.instance) {
      ArtifactChangePropagationService.instance = new ArtifactChangePropagationService();
    }
    return ArtifactChangePropagationService.instance;
  }

  /**
   * Setup event listeners for artifact changes
   */
  private setupEventListeners(): void {
    // Listen for artifact field updates
    eventBus.on(Events.ARTIFACT_FIELD_UPDATED, async (payload) => {
      await this.propagateArtifactChange(payload.data);
    });

    // Listen for bulk updates (using ARTIFACT_UPDATED)
    eventBus.on(Events.ARTIFACT_UPDATED, async (payload) => {
      await this.propagateArtifactChange(payload.data);
    });

    // Listen for rate card updates
    eventBus.on(Events.RATE_CARD_UPDATED, async (payload) => {
      await this.propagateArtifactChange(payload.data);
    });

    logger.info('Event listeners setup complete');
  }

  /**
   * Main propagation method - coordinates all updates
   */
  async propagateArtifactChange(event: ArtifactChangeEvent): Promise<void> {
    try {
      logger.info(
        { artifactId: event.artifactId, artifactType: event.artifactType },
        'Starting artifact change propagation'
      );

      // Publish propagation started event
      await eventBus.publish(Events.PROPAGATION_STARTED, {
        artifactId: event.artifactId,
        contractId: event.contractId,
        tenantId: event.tenantId,
      });

      // 1. Determine affected engines
      const affectedEngines = this.identifyAffectedEngines(event);
      logger.info(
        { engines: affectedEngines.map(e => e.name) },
        'Identified affected engines'
      );

      // 2. Notify each engine in parallel
      const results = await Promise.allSettled(
        affectedEngines.map(engine => this.notifyEngine(engine, event))
      );

      // 3. Update search index
      await this.updateSearchIndex(event.contractId);

      // 4. Update RAG knowledge base
      await this.updateRAGKnowledgeBase(event.contractId, event.artifactType);

      // 5. Process results and handle failures
      const propagationResults = this.processResults(results, affectedEngines);

      // 6. Log propagation results
      await this.logPropagation(event, propagationResults);

      // 7. Publish completion event
      await eventBus.publish(Events.PROPAGATION_COMPLETED, {
        artifactId: event.artifactId,
        contractId: event.contractId,
        tenantId: event.tenantId,
        artifactType: event.artifactType,
        affectedEngines: affectedEngines.map(e => e.name),
        results: propagationResults,
      });

      logger.info(
        { artifactId: event.artifactId, successful: propagationResults.filter(r => r.status === 'success').length },
        'Artifact change propagation completed'
      );
    } catch (error) {
      logger.error({ error, event }, 'Artifact change propagation failed');
      
      // Publish failure event
      await eventBus.publish(Events.PROCESSING_FAILED, {
        artifactId: event.artifactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Add to retry queue if retries remaining
      await this.handlePropagationFailure(event);
    }
  }

  /**
   * Identify which analytical engines are affected by this change
   */
  private identifyAffectedEngines(event: ArtifactChangeEvent): AnalyticalEngine[] {
    const engines: AnalyticalEngine[] = [];

    // Map artifact types to analytical engines
    const engineMap: Record<string, string[]> = {
      'RATES': ['RateCardBenchmarking', 'CostSavings'],
      'FINANCIAL': ['CostSavings', 'SpendOverlay'],
      'CLAUSES': ['Compliance', 'Risk'],
      'OVERVIEW': ['RenewalRadar', 'SupplierSnapshot'],
      'COMPLIANCE': ['Compliance'],
      'RISK': ['Risk', 'SupplierSnapshot'],
    };

    const affectedEngineNames = engineMap[event.artifactType] || [];

    for (const engineName of affectedEngineNames) {
      engines.push({
        name: engineName,
        notifyMethod: this.getEngineNotifyMethod(engineName),
      });
    }

    return engines;
  }

  /**
   * Get the notification method for a specific engine
   */
  private getEngineNotifyMethod(engineName: string): (contractId: string, artifactType: string, data?: any) => Promise<void> {
    return async (contractId: string, artifactType: string, data?: any) => {
      try {
        logger.info({ engineName, contractId }, 'Notifying analytical engine');

        // Import the analytical intelligence service dynamically
        const { analyticalIntelligenceService } = await import('./analytical-intelligence.service');

        switch (engineName) {
          case 'RateCardBenchmarking':
            const rateEngine = analyticalIntelligenceService.getRateCardEngine();
            await rateEngine.parseRateCards(contractId);
            break;

          case 'RenewalRadar':
            const renewalEngine = analyticalIntelligenceService.getRenewalEngine();
            await renewalEngine.extractRenewalData(contractId);
            break;

          case 'Compliance':
            const complianceEngine = analyticalIntelligenceService.getComplianceEngine();
            await complianceEngine.scanContract(contractId);
            break;

          case 'SupplierSnapshot':
            const supplierEngine = analyticalIntelligenceService.getSupplierEngine();
            // Extract supplier ID from artifact data
            const supplierId = data?.supplierId || data?.supplierName;
            if (supplierId) {
              await supplierEngine.aggregateSupplierData(supplierId);
            }
            break;

          case 'SpendOverlay':
            const spendEngine = analyticalIntelligenceService.getSpendEngine();
            // Trigger spend mapping recalculation
            // Note: Spend engine doesn't have a direct update method yet
            logger.info({ contractId }, 'Spend overlay update triggered');
            break;

          case 'CostSavings':
            // Cost savings are calculated as part of rate card benchmarking
            logger.info({ contractId }, 'Cost savings will be recalculated with rate card benchmarking');
            break;

          default:
            logger.warn({ engineName }, 'Unknown engine name');
        }

        logger.info({ engineName, contractId }, 'Engine notification completed');
      } catch (error) {
        logger.error({ error, engineName, contractId }, 'Engine notification failed');
        throw error;
      }
    };
  }

  /**
   * Notify a specific engine of the change
   */
  private async notifyEngine(
    engine: AnalyticalEngine,
    event: ArtifactChangeEvent
  ): Promise<PropagationResult> {
    const startTime = Date.now();

    try {
      await engine.notifyMethod(event.contractId, event.artifactType, event.data);

      return {
        engine: engine.name,
        status: 'success',
        timestamp: new Date(),
        recalculatedItems: [event.contractId],
      };
    } catch (error) {
      logger.error({ error, engine: engine.name }, 'Engine notification failed');

      return {
        engine: engine.name,
        status: 'failed',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        recalculatedItems: [],
      };
    }
  }

  /**
   * Update search index for the contract
   */
  private async updateSearchIndex(contractId: string): Promise<void> {
    try {
      logger.info({ contractId }, 'Updating search index');

      // Import contract indexing service dynamically
      const { contractIndexingService } = await import('./contract-indexing.service');
      await contractIndexingService.indexContract(contractId);

      logger.info({ contractId }, 'Search index updated');
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to update search index');
      // Don't throw - this is not critical
    }
  }

  /**
   * Update RAG knowledge base for the contract
   */
  private async updateRAGKnowledgeBase(contractId: string, artifactType: string): Promise<void> {
    try {
      logger.info({ contractId, artifactType }, 'Updating RAG knowledge base');

      // Import RAG integration service dynamically
      const { ragIntegrationService } = await import('./rag-integration.service');
      await ragIntegrationService.reindexContract(contractId);

      logger.info({ contractId }, 'RAG knowledge base updated');
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to update RAG knowledge base');
      // Don't throw - this is not critical
    }
  }

  /**
   * Process results from engine notifications
   */
  private processResults(
    results: PromiseSettledResult<PropagationResult>[],
    engines: AnalyticalEngine[]
  ): PropagationResult[] {
    const propagationResults: PropagationResult[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const engine = engines[i];

      if (result.status === 'fulfilled') {
        propagationResults.push(result.value);
      } else {
        propagationResults.push({
          engine: engine.name,
          status: 'failed',
          timestamp: new Date(),
          error: result.reason?.message || 'Unknown error',
          recalculatedItems: [],
        });
      }
    }

    return propagationResults;
  }

  /**
   * Log propagation results to database
   */
  private async logPropagation(
    event: ArtifactChangeEvent,
    results: PropagationResult[]
  ): Promise<void> {
    try {
      // Import database adaptor
      const { dbAdaptor } = await import('../dal/database.adaptor');

      // Update artifact with propagation status
      await dbAdaptor.getClient().artifact.update({
        where: { id: event.artifactId },
        data: {
          lastPropagatedAt: new Date(),
          propagationStatus: results.every(r => r.status === 'success') ? 'synced' : 'failed',
          consumedBy: results.filter(r => r.status === 'success').map(r => r.engine),
        },
      });

      // Update artifact edit record with propagation results
      const latestEdit = await dbAdaptor.getClient().artifactEdit.findFirst({
        where: { artifactId: event.artifactId },
        orderBy: { version: 'desc' },
      });

      if (latestEdit) {
        await dbAdaptor.getClient().artifactEdit.update({
          where: { id: latestEdit.id },
          data: {
            affectedEngines: results.map(r => r.engine),
            propagationResults: results as any, // Cast to any to handle Prisma JSON type
          },
        });
      }

      logger.info({ artifactId: event.artifactId }, 'Propagation results logged');
    } catch (error) {
      logger.error({ error, event }, 'Failed to log propagation results');
      // Don't throw - logging failure shouldn't stop the process
    }
  }

  /**
   * Handle propagation failure with retry logic
   */
  private async handlePropagationFailure(event: ArtifactChangeEvent): Promise<void> {
    const key = event.artifactId;
    const existing = this.retryQueue.get(key);

    if (!existing || existing.retryCount < this.maxRetries) {
      const retryCount = (existing?.retryCount || 0) + 1;
      this.retryQueue.set(key, { event, retryCount });

      // Schedule retry with exponential backoff
      const delay = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        this.retryPropagation(key);
      }, delay);

      logger.info(
        { artifactId: event.artifactId, retryCount, delay },
        'Scheduled propagation retry'
      );
    } else {
      // Max retries reached - log permanent failure
      logger.error(
        { artifactId: event.artifactId, retryCount: existing.retryCount },
        'Max retries reached for propagation'
      );

      this.retryQueue.delete(key);

      // TODO: Send notification to administrators
    }
  }

  /**
   * Retry propagation for a failed event
   */
  private async retryPropagation(key: string): Promise<void> {
    const item = this.retryQueue.get(key);
    if (!item) return;

    try {
      await this.propagateArtifactChange(item.event);
      this.retryQueue.delete(key);
    } catch (error) {
      logger.error({ error, key }, 'Retry propagation failed');
      // handlePropagationFailure will be called again
    }
  }

  /**
   * Get propagation statistics
   */
  getStats(): {
    pendingRetries: number;
    retryQueue: Array<{ artifactId: string; retryCount: number }>;
  } {
    return {
      pendingRetries: this.retryQueue.size,
      retryQueue: Array.from(this.retryQueue.entries()).map(([key, value]) => ({
        artifactId: key,
        retryCount: value.retryCount,
      })),
    };
  }
}

export const artifactChangePropagationService = ArtifactChangePropagationService.getInstance();
