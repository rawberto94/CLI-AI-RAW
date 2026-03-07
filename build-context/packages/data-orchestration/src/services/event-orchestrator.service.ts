/**
 * Event Orchestrator Service
 * Coordinates complex event-driven workflows and data propagation
 */

import { eventBus, Events } from '../events/event-bus';
import { cacheInvalidationService } from './cache-invalidation.service';

export interface EventContext {
  userId?: string;
  tenantId: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

export class EventOrchestratorService {
  private processingQueue: Map<string, Promise<void>> = new Map();

  constructor() {
    this.setupCoreEventHandlers();
  }

  /**
   * Setup core event handlers for data flow orchestration
   */
  private setupCoreEventHandlers(): void {
    // Contract Upload Complete -> Trigger downstream processing
    eventBus.on(Events.PROCESSING_COMPLETED, async (data) => {
      await this.handleContractProcessingComplete(data);
    });

    // Artifact Generated -> Trigger dependent services
    eventBus.on(Events.ARTIFACT_GENERATED, async (data) => {
      await this.handleArtifactGenerated(data);
    });

    // Rate Card Updated -> Recalculate benchmarks
    eventBus.on(Events.RATE_CARD_UPDATED, async (data) => {
      await this.handleRateCardUpdated(data);
    });

    // Rate Card Imported (bulk) -> Batch recalculation
    eventBus.on(Events.RATE_CARD_IMPORTED, async (data) => {
      await this.handleRateCardBulkImport(data);
    });

    // Metadata Updated -> Propagate changes
    eventBus.on(Events.CONTRACT_METADATA_UPDATED, async (data) => {
      await this.handleMetadataUpdated(data);
    });

    // Artifact Updated -> Propagate to dependent artifacts
    eventBus.on(Events.ARTIFACT_UPDATED, async (data) => {
      await this.handleArtifactUpdated(data);
    });
  }

  /**
   * Handle contract processing completion
   */
  private async handleContractProcessingComplete(data: any): Promise<void> {
    const { contractId, tenantId } = data;
    const queueKey = `contract-complete:${contractId}`;

    // Prevent duplicate processing
    if (this.processingQueue.has(queueKey)) {
      return;
    }

    const processingPromise = (async () => {
      try {
        // Emit events for downstream services
        eventBus.emit(Events.ANALYTICS_UPDATED, {
          contractId,
          tenantId,
          type: 'contract_completed'
        });

        // Trigger rate card extraction if applicable
        eventBus.emit('contract:ready-for-extraction', {
          contractId,
          tenantId
        });

        // Trigger savings analysis
        eventBus.emit('contract:analyze-savings', {
          contractId,
          tenantId
        });

      } catch {
        // Error handling contract completion
      } finally {
        this.processingQueue.delete(queueKey);
      }
    })();

    this.processingQueue.set(queueKey, processingPromise);
    await processingPromise;
  }

  /**
   * Handle artifact generation
   */
  private async handleArtifactGenerated(data: any): Promise<void> {
    const { artifactId, contractId, type, tenantId } = data;

    try {
      // If it's a rates artifact, trigger rate card extraction
      if (type === 'rates' || type === 'financial') {
        eventBus.emit('artifact:extract-rates', {
          artifactId,
          contractId,
          tenantId
        });
      }

      // Trigger cost savings analysis
      if (type === 'financial') {
        eventBus.emit('artifact:analyze-costs', {
          artifactId,
          contractId,
          tenantId
        });
      }

    } catch {
      // Error handling artifact generation
    }
  }

  /**
   * Handle rate card update
   */
  private async handleRateCardUpdated(data: any): Promise<void> {
    const { id, supplierName, roleStandardized, tenantId } = data;

    try {
      // Trigger benchmark recalculation
      eventBus.emit(Events.BENCHMARK_INVALIDATED, {
        rateCardId: id,
        supplierName,
        roleStandardized,
        tenantId
      });

      // Trigger opportunity recalculation
      eventBus.emit('opportunities:recalculate', {
        rateCardId: id,
        tenantId
      });

      // Check for alerts
      eventBus.emit('alerts:check', {
        rateCardId: id,
        tenantId
      });

    } catch {
      // Error handling rate card update
    }
  }

  /**
   * Handle bulk rate card import
   */
  private async handleRateCardBulkImport(data: any): Promise<void> {
    const { count, tenantId, source } = data;

    try {
      // Trigger batch benchmark recalculation
      eventBus.emit('benchmarks:batch-recalculate', {
        tenantId,
        source
      });

      // Trigger batch opportunity analysis
      eventBus.emit('opportunities:batch-analyze', {
        tenantId
      });

      // Invalidate all related caches
      await cacheInvalidationService.invalidateTags([
        'rate-cards',
        'benchmarks',
        'opportunities',
        'analytics'
      ]);

    } catch {
      // Error handling bulk import
    }
  }

  /**
   * Handle metadata update
   */
  private async handleMetadataUpdated(data: any): Promise<void> {
    const { contractId, changes, tenantId } = data;

    try {
      // If financial data changed, trigger artifact regeneration
      if (changes.financial) {
        eventBus.emit('artifacts:regenerate-financial', {
          contractId,
          tenantId
        });
      }

      // If parties changed, update related data
      if (changes.parties) {
        eventBus.emit('contract:parties-updated', {
          contractId,
          tenantId
        });
      }

    } catch {
      // Error handling metadata update
    }
  }

  /**
   * Handle artifact update
   */
  private async handleArtifactUpdated(data: any): Promise<void> {
    const { artifactId, contractId, changes, tenantId } = data;

    try {
      // Trigger propagation to dependent artifacts
      eventBus.emit(Events.PROPAGATION_STARTED, {
        artifactId,
        contractId,
        tenantId
      });

      // If rates changed, update extracted rate cards
      if (changes.rates) {
        eventBus.emit('artifact:rates-changed', {
          artifactId,
          contractId,
          tenantId
        });
      }

    } catch {
      // Error handling artifact update
    }
  }

  /**
   * Emit a coordinated event with context
   */
  async emitWithContext(
    event: Events | string,
    data: any,
    context: EventContext
  ): Promise<void> {
    const enrichedData = {
      ...data,
      _context: context,
      _timestamp: new Date().toISOString()
    };

    eventBus.emit(event, enrichedData);
  }

  /**
   * Get processing queue status
   */
  getQueueStatus(): { active: number; keys: string[] } {
    return {
      active: this.processingQueue.size,
      keys: Array.from(this.processingQueue.keys())
    };
  }

  /**
   * Wait for all pending processing to complete
   */
  async waitForProcessing(): Promise<void> {
    await Promise.all(Array.from(this.processingQueue.values()));
  }
}

export const eventOrchestratorService = new EventOrchestratorService();
