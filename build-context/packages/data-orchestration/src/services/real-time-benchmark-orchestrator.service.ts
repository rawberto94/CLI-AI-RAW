/**
 * Real-Time Benchmark Orchestrator Service
 * 
 * Integrates with the event bus to trigger real-time benchmark recalculation
 * when rate card data changes. Coordinates between invalidation and recalculation.
 * 
 * @module RealTimeBenchmarkOrchestrator
 */

import { PrismaClient } from '@prisma/client';
import { eventBus, Events } from '../events/event-bus';
import { RealTimeBenchmarkService } from './real-time-benchmark.service';
import { BenchmarkInvalidationService } from './benchmark-invalidation.service';

export interface RateCardEventData {
  rateCardEntryId: string;
  tenantId: string;
  action: 'created' | 'updated' | 'deleted';
  previousData?: any;
}

export interface BenchmarkRecalculationEvent {
  rateCardEntryId: string;
  tenantId: string;
  triggeredBy: string;
  startedAt: Date;
  completedAt?: Date;
  success: boolean;
  durationMs?: number;
  affectedCount?: number;
  error?: string;
}

/**
 * Real-Time Benchmark Orchestrator
 * Coordinates event-driven benchmark updates
 */
export class RealTimeBenchmarkOrchestrator {
  private prisma: PrismaClient;
  private realTimeBenchmarkService: RealTimeBenchmarkService;
  private invalidationService: BenchmarkInvalidationService;
  private isInitialized: boolean = false;
  private recalculationEvents: BenchmarkRecalculationEvent[] = [];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.realTimeBenchmarkService = new RealTimeBenchmarkService(prisma);
    this.invalidationService = new BenchmarkInvalidationService(prisma);
  }

  /**
   * Initialize event listeners
   * Sets up listeners for rate card create/update/delete events
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Listen for rate card created events
    eventBus.on(Events.RATE_CARD_CREATED, async (data: RateCardEventData) => {
      await this.handleRateCardCreated(data);
    });

    // Listen for rate card updated events
    eventBus.on(Events.RATE_CARD_UPDATED, async (data: RateCardEventData) => {
      await this.handleRateCardUpdated(data);
    });

    // Listen for rate card deleted events
    eventBus.on(Events.RATE_CARD_DELETED, async (data: RateCardEventData) => {
      await this.handleRateCardDeleted(data);
    });

    // Listen for bulk import events
    eventBus.on(Events.RATE_CARD_IMPORTED, async (data: { rateCardEntryIds: string[]; tenantId: string }) => {
      await this.handleBulkImport(data);
    });

    this.isInitialized = true;
  }

  /**
   * Shutdown event listeners
   */
  shutdown(): void {
    eventBus.removeAllListeners(Events.RATE_CARD_CREATED);
    eventBus.removeAllListeners(Events.RATE_CARD_UPDATED);
    eventBus.removeAllListeners(Events.RATE_CARD_DELETED);
    eventBus.removeAllListeners(Events.RATE_CARD_IMPORTED);
    this.isInitialized = false;
  }

  /**
   * Handle rate card created event
   */
  private async handleRateCardCreated(data: RateCardEventData): Promise<void> {
    const startTime = Date.now();
    const event: BenchmarkRecalculationEvent = {
      rateCardEntryId: data.rateCardEntryId,
      tenantId: data.tenantId,
      triggeredBy: 'RATE_CARD_CREATED',
      startedAt: new Date(),
      success: false,
    };

    try {
      // Emit recalculating event
      eventBus.emit(Events.BENCHMARK_RECALCULATING, {
        rateCardEntryId: data.rateCardEntryId,
        tenantId: data.tenantId,
      });

      // Step 1: Invalidate affected cache entries
      const invalidationResult = await this.invalidationService.onRateCardCreated(data.rateCardEntryId);

      // Emit invalidation event
      eventBus.emit(Events.BENCHMARK_INVALIDATED, {
        rateCardEntryId: data.rateCardEntryId,
        tenantId: data.tenantId,
        keysInvalidated: invalidationResult.keysInvalidated,
      });

      // Step 2: Recalculate benchmark
      const recalcResult = await this.realTimeBenchmarkService.recalculateBenchmark(data.rateCardEntryId);

      event.success = recalcResult.success;
      event.completedAt = new Date();
      event.durationMs = Date.now() - startTime;
      event.affectedCount = recalcResult.affectedCount;
      event.error = recalcResult.error;

      // Emit benchmark calculated event
      if (recalcResult.success) {
        eventBus.emit(Events.BENCHMARK_CALCULATED, {
          rateCardEntryId: data.rateCardEntryId,
          tenantId: data.tenantId,
          benchmark: recalcResult.benchmark,
          durationMs: recalcResult.durationMs,
          affectedCount: recalcResult.affectedCount,
        });
      }
    } catch (error) {
      event.success = false;
      event.completedAt = new Date();
      event.durationMs = Date.now() - startTime;
      event.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      this.trackRecalculationEvent(event);
    }
  }

  /**
   * Handle rate card updated event
   */
  private async handleRateCardUpdated(data: RateCardEventData): Promise<void> {
    const startTime = Date.now();
    const event: BenchmarkRecalculationEvent = {
      rateCardEntryId: data.rateCardEntryId,
      tenantId: data.tenantId,
      triggeredBy: 'RATE_CARD_UPDATED',
      startedAt: new Date(),
      success: false,
    };

    try {
      // Emit recalculating event
      eventBus.emit(Events.BENCHMARK_RECALCULATING, {
        rateCardEntryId: data.rateCardEntryId,
        tenantId: data.tenantId,
      });

      // Step 1: Invalidate affected cache entries
      const invalidationResult = await this.invalidationService.onRateCardUpdated(data.rateCardEntryId);

      // Emit invalidation event
      eventBus.emit(Events.BENCHMARK_INVALIDATED, {
        rateCardEntryId: data.rateCardEntryId,
        tenantId: data.tenantId,
        keysInvalidated: invalidationResult.keysInvalidated,
      });

      // Step 2: Recalculate benchmark
      const recalcResult = await this.realTimeBenchmarkService.recalculateBenchmark(data.rateCardEntryId);

      event.success = recalcResult.success;
      event.completedAt = new Date();
      event.durationMs = Date.now() - startTime;
      event.affectedCount = recalcResult.affectedCount;
      event.error = recalcResult.error;

      // Emit benchmark calculated event
      if (recalcResult.success) {
        eventBus.emit(Events.BENCHMARK_CALCULATED, {
          rateCardEntryId: data.rateCardEntryId,
          tenantId: data.tenantId,
          benchmark: recalcResult.benchmark,
          durationMs: recalcResult.durationMs,
          affectedCount: recalcResult.affectedCount,
        });
      }
    } catch (error) {
      event.success = false;
      event.completedAt = new Date();
      event.durationMs = Date.now() - startTime;
      event.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      this.trackRecalculationEvent(event);
    }
  }

  /**
   * Handle rate card deleted event
   */
  private async handleRateCardDeleted(data: RateCardEventData): Promise<void> {
    const startTime = Date.now();
    const event: BenchmarkRecalculationEvent = {
      rateCardEntryId: data.rateCardEntryId,
      tenantId: data.tenantId,
      triggeredBy: 'RATE_CARD_DELETED',
      startedAt: new Date(),
      success: false,
    };

    try {
      // For deletions, we only invalidate cache (no recalculation needed for deleted entry)
      if (data.previousData) {
        const invalidationResult = await this.invalidationService.onRateCardDeleted(
          data.rateCardEntryId,
          data.previousData
        );

        event.success = invalidationResult.success;
        event.completedAt = new Date();
        event.durationMs = Date.now() - startTime;

        // Emit invalidation event
        eventBus.emit(Events.BENCHMARK_INVALIDATED, {
          rateCardEntryId: data.rateCardEntryId,
          tenantId: data.tenantId,
          keysInvalidated: invalidationResult.keysInvalidated,
        });
      }
    } catch (error) {
      event.success = false;
      event.completedAt = new Date();
      event.durationMs = Date.now() - startTime;
      event.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      this.trackRecalculationEvent(event);
    }
  }

  /**
   * Handle bulk import event
   */
  private async handleBulkImport(data: { rateCardEntryIds: string[]; tenantId: string }): Promise<void> {
    try {
      // Invalidate all benchmarks for the tenant
      await this.invalidationService.invalidateAllBenchmarks(data.tenantId);

      // Batch recalculate
      const results = await this.realTimeBenchmarkService.batchRecalculate(data.rateCardEntryIds);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      // Emit event for bulk completion
      eventBus.emit(Events.BENCHMARK_CALCULATED, {
        tenantId: data.tenantId,
        bulkOperation: true,
        totalCount: data.rateCardEntryIds.length,
        successCount,
        failureCount,
      });
    } catch {
      // Error handling bulk import
    }
  }

  /**
   * Track recalculation event
   */
  private trackRecalculationEvent(event: BenchmarkRecalculationEvent): void {
    this.recalculationEvents.push(event);

    // Keep only last 1000 events
    if (this.recalculationEvents.length > 1000) {
      this.recalculationEvents.shift();
    }
  }

  /**
   * Get recent recalculation events
   */
  getRecentRecalculations(limit: number = 100): BenchmarkRecalculationEvent[] {
    return this.recalculationEvents
      .slice(-limit)
      .reverse();
  }

  /**
   * Get recalculation statistics
   */
  getRecalculationStatistics(): {
    totalRecalculations: number;
    successfulRecalculations: number;
    failedRecalculations: number;
    averageDurationMs: number;
    totalAffectedBenchmarks: number;
  } {
    const total = this.recalculationEvents.length;
    const successful = this.recalculationEvents.filter(e => e.success).length;
    const failed = this.recalculationEvents.filter(e => !e.success).length;
    
    const durations = this.recalculationEvents
      .filter(e => e.durationMs !== undefined)
      .map(e => e.durationMs!);
    
    const averageDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    const totalAffected = this.recalculationEvents
      .filter(e => e.affectedCount !== undefined)
      .reduce((sum, e) => sum + (e.affectedCount || 0), 0);

    return {
      totalRecalculations: total,
      successfulRecalculations: successful,
      failedRecalculations: failed,
      averageDurationMs: Math.round(averageDuration),
      totalAffectedBenchmarks: totalAffected,
    };
  }

  /**
   * Manually trigger recalculation for a rate card
   */
  async triggerManualRecalculation(rateCardEntryId: string): Promise<void> {
    const rateCard = await this.prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId },
    });

    if (!rateCard) {
      throw new Error(`Rate card entry not found: ${rateCardEntryId}`);
    }

    await this.handleRateCardUpdated({
      rateCardEntryId,
      tenantId: rateCard.tenantId,
      action: 'updated',
    });
  }

  /**
   * Clear recalculation history (for testing)
   */
  clearRecalculationHistory(): void {
    this.recalculationEvents = [];
  }
}

export default RealTimeBenchmarkOrchestrator;
