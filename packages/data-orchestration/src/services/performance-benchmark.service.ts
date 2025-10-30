import { PrismaClient } from '@prisma/client';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

interface BenchmarkCalculationOptions {
  tenantId: string;
  rateCardIds?: string[];
  parallel?: boolean;
  batchSize?: number;
  useCache?: boolean;
}

interface BenchmarkResult {
  rateCardId: string;
  median: number;
  mean: number;
  p25: number;
  p75: number;
  cohortSize: number;
  calculationTime: number;
}

/**
 * Performance-optimized Benchmark Calculation Service
 * Handles large-scale benchmark calculations efficiently
 */
export class PerformanceBenchmarkService extends EventEmitter {
  private cache: Map<string, { result: BenchmarkResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 3600000; // 1 hour
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly MAX_PARALLEL_WORKERS = 4;

  /**
   * Calculate benchmarks for multiple rate cards
   */
  async calculateBenchmarks(
    options: BenchmarkCalculationOptions
  ): Promise<BenchmarkResult[]> {
    const startTime = Date.now();

    // Get rate cards to process
    const rateCardIds = options.rateCardIds || (await this.getAllRateCardIds(options.tenantId));

    this.emit('calculation:started', {
      totalRateCards: rateCardIds.length,
      parallel: options.parallel,
    });

    let results: BenchmarkResult[];

    if (options.parallel && rateCardIds.length > this.DEFAULT_BATCH_SIZE) {
      // Parallel processing for large datasets
      results = await this.calculateParallel(rateCardIds, options);
    } else {
      // Sequential processing for smaller datasets
      results = await this.calculateSequential(rateCardIds, options);
    }

    const totalTime = Date.now() - startTime;

    this.emit('calculation:completed', {
      totalRateCards: rateCardIds.length,
      totalTime,
      averageTime: totalTime / rateCardIds.length,
    });

    return results;
  }

  /**
   * Calculate benchmarks sequentially in batches
   */
  private async calculateSequential(
    rateCardIds: string[],
    options: BenchmarkCalculationOptions
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    const batchSize = options.batchSize || this.DEFAULT_BATCH_SIZE;

    for (let i = 0; i < rateCardIds.length; i += batchSize) {
      const batch = rateCardIds.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch, options);
      results.push(...batchResults);

      this.emit('calculation:progress', {
        processed: Math.min(i + batchSize, rateCardIds.length),
        total: rateCardIds.length,
        percentage: Math.floor((Math.min(i + batchSize, rateCardIds.length) / rateCardIds.length) * 100),
      });
    }

    return results;
  }

  /**
   * Calculate benchmarks in parallel using worker threads
   */
  private async calculateParallel(
    rateCardIds: string[],
    options: BenchmarkCalculationOptions
  ): Promise<BenchmarkResult[]> {
    const batchSize = Math.ceil(rateCardIds.length / this.MAX_PARALLEL_WORKERS);
    const batches: string[][] = [];

    for (let i = 0; i < rateCardIds.length; i += batchSize) {
      batches.push(rateCardIds.slice(i, i + batchSize));
    }

    const promises = batches.map((batch) => this.processBatch(batch, options));
    const batchResults = await Promise.all(promises);

    return batchResults.flat();
  }

  /**
   * Process a batch of rate cards
   */
  private async processBatch(
    rateCardIds: string[],
    options: BenchmarkCalculationOptions
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const rateCardId of rateCardIds) {
      // Check cache first
      if (options.useCache !== false) {
        const cached = this.getFromCache(rateCardId);
        if (cached) {
          results.push(cached);
          continue;
        }
      }

      // Calculate benchmark
      const result = await this.calculateSingleBenchmark(rateCardId, options.tenantId);
      results.push(result);

      // Cache result
      if (options.useCache !== false) {
        this.addToCache(rateCardId, result);
      }
    }

    return results;
  }

  /**
   * Calculate benchmark for a single rate card
   */
  private async calculateSingleBenchmark(
    rateCardId: string,
    tenantId: string
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();

    // Get rate card details
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardId },
      select: {
        roleStandardized: true,
        seniority: true,
        country: true,
        dailyRateUSD: true,
      },
    });

    if (!rateCard) {
      throw new Error(`Rate card not found: ${rateCardId}`);
    }

    // Get comparable rates using optimized query
    const comparableRates = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        country: rateCard.country,
      },
      select: {
        dailyRateUSD: true,
      },
    });

    // Calculate statistics
    const rates = comparableRates.map((r) => Number(r.dailyRateUSD)).sort((a, b) => a - b);
    const cohortSize = rates.length;

    const median = this.calculateMedian(rates);
    const mean = this.calculateMean(rates);
    const p25 = this.calculatePercentile(rates, 25);
    const p75 = this.calculatePercentile(rates, 75);

    const calculationTime = Date.now() - startTime;

    return {
      rateCardId,
      median,
      mean,
      p25,
      p75,
      cohortSize,
      calculationTime,
    };
  }

  /**
   * Get all rate card IDs for tenant
   */
  private async getAllRateCardIds(tenantId: string): Promise<string[]> {
    const rateCards = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: { id: true },
    });

    return rateCards.map((rc) => rc.id);
  }

  /**
   * Get result from cache
   */
  private getFromCache(rateCardId: string): BenchmarkResult | null {
    const cached = this.cache.get(rateCardId);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
      this.cache.delete(rateCardId);
      return null;
    }

    return cached.result;
  }

  /**
   * Add result to cache
   */
  private addToCache(rateCardId: string, result: BenchmarkResult): void {
    this.cache.set(rateCardId, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  /**
   * Calculate median
   */
  private calculateMedian(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
  }

  /**
   * Calculate mean
   */
  private calculateMean(array: number[]): number {
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Warm up cache with frequently accessed rate cards
   */
  async warmUpCache(tenantId: string, limit: number = 1000): Promise<void> {
    const recentRateCards = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true },
    });

    await this.calculateBenchmarks({
      tenantId,
      rateCardIds: recentRateCards.map((rc) => rc.id),
      parallel: true,
      useCache: true,
    });
  }
}

export const performanceBenchmarkService = new PerformanceBenchmarkService();
