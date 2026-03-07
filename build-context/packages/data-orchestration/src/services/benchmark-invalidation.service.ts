/**
 * Benchmark Invalidation Service
 * 
 * Manages cache invalidation for benchmark data when rate cards change.
 * Tracks invalidation events and ensures cache consistency.
 * 
 * @module BenchmarkInvalidationService
 */

import { PrismaClient } from '@prisma/client';

export interface InvalidationEvent {
  id: string;
  rateCardEntryId: string;
  tenantId: string;
  reason: 'RATE_CARD_CREATED' | 'RATE_CARD_UPDATED' | 'RATE_CARD_DELETED' | 'MANUAL_INVALIDATION';
  affectedCohorts: string[];
  invalidatedAt: Date;
  cacheKeysInvalidated: string[];
}

export interface CacheInvalidationResult {
  success: boolean;
  keysInvalidated: number;
  errors: string[];
}

export interface CohortIdentifier {
  roleStandardized: string;
  seniority: string;
  country: string;
  lineOfService: string;
}

/**
 * Benchmark Invalidation Service
 * Handles cache invalidation for benchmark calculations
 */
export class BenchmarkInvalidationService {
  private prisma: PrismaClient;
  private invalidationEvents: InvalidationEvent[];
  private cacheStore: Map<string, any>; // In-memory cache simulation

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.invalidationEvents = [];
    this.cacheStore = new Map();
  }

  /**
   * Invalidate cache entries affected by a rate card change
   */
  async invalidateAffectedBenchmarks(rateCardEntryId: string): Promise<CacheInvalidationResult> {
    const errors: string[] = [];
    const keysInvalidated: string[] = [];

    try {
      // Get the rate card entry
      const rateCard = await this.prisma.rateCardEntry.findUnique({
        where: { id: rateCardEntryId },
      });

      if (!rateCard) {
        errors.push(`Rate card entry not found: ${rateCardEntryId}`);
        return { success: false, keysInvalidated: 0, errors };
      }

      // Identify affected cohorts
      const affectedCohorts = this.identifyAffectedCohorts(rateCard);

      // Generate cache keys to invalidate
      const cacheKeys = this.generateCacheKeys(affectedCohorts, rateCard.tenantId);

      // Invalidate each cache key
      for (const key of cacheKeys) {
        try {
          await this.invalidateCacheKey(key);
          keysInvalidated.push(key);
        } catch (error) {
          errors.push(`Failed to invalidate key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Track invalidation event
      await this.trackInvalidationEvent({
        id: this.generateEventId(),
        rateCardEntryId,
        tenantId: rateCard.tenantId,
        reason: 'RATE_CARD_UPDATED',
        affectedCohorts: affectedCohorts.map(c => this.cohortToString(c)),
        invalidatedAt: new Date(),
        cacheKeysInvalidated: keysInvalidated,
      });

      return {
        success: errors.length === 0,
        keysInvalidated: keysInvalidated.length,
        errors,
      };
    } catch (error) {
      errors.push(`Invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, keysInvalidated: 0, errors };
    }
  }

  /**
   * Invalidate all benchmarks for a tenant
   */
  async invalidateAllBenchmarks(tenantId: string): Promise<CacheInvalidationResult> {
    const errors: string[] = [];
    const keysInvalidated: string[] = [];

    try {
      // Get all unique cohorts for the tenant
      const uniqueCohorts = await this.prisma.rateCardEntry.findMany({
        where: { tenantId },
        distinct: ['roleStandardized', 'seniority', 'country', 'lineOfService'],
        select: {
          roleStandardized: true,
          seniority: true,
          country: true,
          lineOfService: true,
        },
      });

      const cohorts: CohortIdentifier[] = uniqueCohorts.map(c => ({
        roleStandardized: c.roleStandardized,
        seniority: c.seniority,
        country: c.country,
        lineOfService: c.lineOfService,
      }));

      // Generate cache keys
      const cacheKeys = this.generateCacheKeys(cohorts, tenantId);

      // Invalidate all keys
      for (const key of cacheKeys) {
        try {
          await this.invalidateCacheKey(key);
          keysInvalidated.push(key);
        } catch (error) {
          errors.push(`Failed to invalidate key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Track invalidation event
      await this.trackInvalidationEvent({
        id: this.generateEventId(),
        rateCardEntryId: 'ALL',
        tenantId,
        reason: 'MANUAL_INVALIDATION',
        affectedCohorts: cohorts.map(c => this.cohortToString(c)),
        invalidatedAt: new Date(),
        cacheKeysInvalidated: keysInvalidated,
      });

      return {
        success: errors.length === 0,
        keysInvalidated: keysInvalidated.length,
        errors,
      };
    } catch (error) {
      errors.push(`Bulk invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, keysInvalidated: 0, errors };
    }
  }

  /**
   * Invalidate benchmarks for a specific cohort
   */
  async invalidateCohort(cohort: CohortIdentifier, tenantId: string): Promise<CacheInvalidationResult> {
    const errors: string[] = [];
    const keysInvalidated: string[] = [];

    try {
      const cacheKeys = this.generateCacheKeys([cohort], tenantId);

      for (const key of cacheKeys) {
        try {
          await this.invalidateCacheKey(key);
          keysInvalidated.push(key);
        } catch (error) {
          errors.push(`Failed to invalidate key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Track invalidation event
      await this.trackInvalidationEvent({
        id: this.generateEventId(),
        rateCardEntryId: 'COHORT',
        tenantId,
        reason: 'MANUAL_INVALIDATION',
        affectedCohorts: [this.cohortToString(cohort)],
        invalidatedAt: new Date(),
        cacheKeysInvalidated: keysInvalidated,
      });

      return {
        success: errors.length === 0,
        keysInvalidated: keysInvalidated.length,
        errors,
      };
    } catch (error) {
      errors.push(`Cohort invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, keysInvalidated: 0, errors };
    }
  }

  /**
   * Identify cohorts affected by a rate card change
   */
  private identifyAffectedCohorts(rateCard: any): CohortIdentifier[] {
    const cohorts: CohortIdentifier[] = [];

    // Primary cohort (exact match)
    cohorts.push({
      roleStandardized: rateCard.roleStandardized,
      seniority: rateCard.seniority,
      country: rateCard.country,
      lineOfService: rateCard.lineOfService,
    });

    // Related cohorts (same role/seniority, different geography)
    cohorts.push({
      roleStandardized: rateCard.roleStandardized,
      seniority: rateCard.seniority,
      country: 'ALL', // Aggregate across all countries
      lineOfService: rateCard.lineOfService,
    });

    // Related cohorts (same role, different seniority)
    cohorts.push({
      roleStandardized: rateCard.roleStandardized,
      seniority: 'ALL', // Aggregate across all seniorities
      country: rateCard.country,
      lineOfService: rateCard.lineOfService,
    });

    return cohorts;
  }

  /**
   * Generate cache keys for cohorts
   */
  private generateCacheKeys(cohorts: CohortIdentifier[], tenantId: string): string[] {
    const keys: string[] = [];

    for (const cohort of cohorts) {
      // Benchmark cache key
      keys.push(`benchmark:${tenantId}:${this.cohortToString(cohort)}`);

      // Statistics cache key
      keys.push(`stats:${tenantId}:${this.cohortToString(cohort)}`);

      // Market intelligence cache key
      keys.push(`market:${tenantId}:${this.cohortToString(cohort)}`);

      // Best rate cache key
      keys.push(`bestrate:${tenantId}:${this.cohortToString(cohort)}`);
    }

    return keys;
  }

  /**
   * Convert cohort to string identifier
   */
  private cohortToString(cohort: CohortIdentifier): string {
    return `${cohort.roleStandardized}:${cohort.seniority}:${cohort.country}:${cohort.lineOfService}`;
  }

  /**
   * Invalidate a specific cache key
   * In production, this would integrate with Redis or similar cache
   */
  private async invalidateCacheKey(key: string): Promise<void> {
    // Remove from in-memory cache
    this.cacheStore.delete(key);

    // In production, would call:
    // await redis.del(key);
    // or
    // await cacheClient.invalidate(key);
  }

  /**
   * Track invalidation event
   */
  private async trackInvalidationEvent(event: InvalidationEvent): Promise<void> {
    this.invalidationEvents.push(event);

    // Keep only last 1000 events
    if (this.invalidationEvents.length > 1000) {
      this.invalidationEvents.shift();
    }

    // In production, would persist to database:
    // await this.prisma.cacheInvalidationEvent.create({ data: event });
  }

  /**
   * Get recent invalidation events
   */
  getRecentInvalidations(limit: number = 100): InvalidationEvent[] {
    return this.invalidationEvents
      .slice(-limit)
      .reverse();
  }

  /**
   * Get invalidation events for a specific rate card
   */
  getInvalidationsForRateCard(rateCardEntryId: string): InvalidationEvent[] {
    return this.invalidationEvents
      .filter(e => e.rateCardEntryId === rateCardEntryId)
      .reverse();
  }

  /**
   * Get invalidation events for a tenant
   */
  getInvalidationsForTenant(tenantId: string, limit: number = 100): InvalidationEvent[] {
    return this.invalidationEvents
      .filter(e => e.tenantId === tenantId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all invalidation events (for testing)
   */
  clearInvalidationHistory(): void {
    this.invalidationEvents = [];
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    totalKeys: number;
    invalidationEvents: number;
    oldestEvent?: Date;
    newestEvent?: Date;
  } {
    return {
      totalKeys: this.cacheStore.size,
      invalidationEvents: this.invalidationEvents.length,
      oldestEvent: this.invalidationEvents.length > 0 
        ? this.invalidationEvents[0].invalidatedAt 
        : undefined,
      newestEvent: this.invalidationEvents.length > 0 
        ? this.invalidationEvents[this.invalidationEvents.length - 1].invalidatedAt 
        : undefined,
    };
  }

  /**
   * Invalidate on rate card creation
   */
  async onRateCardCreated(rateCardEntryId: string): Promise<CacheInvalidationResult> {
    return this.invalidateAffectedBenchmarks(rateCardEntryId);
  }

  /**
   * Invalidate on rate card update
   */
  async onRateCardUpdated(rateCardEntryId: string): Promise<CacheInvalidationResult> {
    return this.invalidateAffectedBenchmarks(rateCardEntryId);
  }

  /**
   * Invalidate on rate card deletion
   */
  async onRateCardDeleted(rateCardEntryId: string, rateCardData: any): Promise<CacheInvalidationResult> {
    const errors: string[] = [];
    const keysInvalidated: string[] = [];

    try {
      // Identify affected cohorts from the deleted rate card data
      const affectedCohorts = this.identifyAffectedCohorts(rateCardData);

      // Generate cache keys
      const cacheKeys = this.generateCacheKeys(affectedCohorts, rateCardData.tenantId);

      // Invalidate each key
      for (const key of cacheKeys) {
        try {
          await this.invalidateCacheKey(key);
          keysInvalidated.push(key);
        } catch (error) {
          errors.push(`Failed to invalidate key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Track invalidation event
      await this.trackInvalidationEvent({
        id: this.generateEventId(),
        rateCardEntryId,
        tenantId: rateCardData.tenantId,
        reason: 'RATE_CARD_DELETED',
        affectedCohorts: affectedCohorts.map(c => this.cohortToString(c)),
        invalidatedAt: new Date(),
        cacheKeysInvalidated: keysInvalidated,
      });

      return {
        success: errors.length === 0,
        keysInvalidated: keysInvalidated.length,
        errors,
      };
    } catch (error) {
      errors.push(`Deletion invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, keysInvalidated: 0, errors };
    }
  }
}

export default BenchmarkInvalidationService;
