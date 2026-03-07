/**
 * Load Testing Script for Rate Card Module
 * Tests system performance under heavy load
 */

import { PrismaClient } from 'clients-db';
import { RateCardEntryService } from '../../src/services/rate-card-entry.service';
import { RateCardBenchmarkingEngine } from '../../src/services/rate-card-benchmarking.service';
import { PerformanceOptimizationService } from '../../src/services/performance-optimization.service';

const prisma = new PrismaClient();

interface LoadTestResult {
  testName: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalDuration: number;
  averageDuration: number;
  operationsPerSecond: number;
  p50: number;
  p95: number;
  p99: number;
}

class RateCardLoadTester {
  private entryService: RateCardEntryService;
  private benchmarkingEngine: RateCardBenchmarkingEngine;
  private perfService: PerformanceOptimizationService;

  constructor() {
    this.entryService = new RateCardEntryService(prisma);
    this.benchmarkingEngine = new RateCardBenchmarkingEngine(prisma);
    this.perfService = new PerformanceOptimizationService(prisma);
  }

  /**
   * Test 1: Bulk Entry Creation
   */
  async testBulkEntryCreation(count: number, tenantId: string): Promise<LoadTestResult> {
    console.log(`\n🔄 Testing bulk entry creation (${count} entries)...`);
    
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = Date.now();

    const roles = ['Software Engineer', 'Project Manager', 'Business Analyst', 'Data Scientist', 'DevOps Engineer'];
    const countries = ['USA', 'UK', 'Germany', 'India', 'Canada'];
    const seniorities = ['JUNIOR', 'MID', 'SENIOR', 'LEAD'];

    for (let i = 0; i < count; i++) {
      const opStart = Date.now();
      
      try {
        await this.entryService.createEntry({
          source: 'MANUAL',
          supplierName: `Load Test Supplier ${i % 50}`,
          supplierTier: 'TIER_2',
          supplierCountry: countries[i % countries.length],
          roleOriginal: roles[i % roles.length],
          roleStandardized: roles[i % roles.length],
          seniority: seniorities[i % seniorities.length] as any,
          lineOfService: 'Technology',
          roleCategory: 'Engineering',
          dailyRate: 800 + (i % 1000),
          currency: 'USD',
          country: countries[i % countries.length],
          region: 'Test Region',
          effectiveDate: new Date(),
          isNegotiated: i % 2 === 0,
        }, tenantId, 'load-test-user');

        successful++;
      } catch (error) {
        failed++;
        console.error(`Entry ${i} failed:`, error);
      }

      durations.push(Date.now() - opStart);

      // Progress indicator
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${count} entries created`);
      }
    }

    const totalDuration = Date.now() - startTime;

    return this.calculateResults('Bulk Entry Creation', count, successful, failed, durations, totalDuration);
  }

  /**
   * Test 2: Concurrent Benchmark Calculations
   */
  async testConcurrentBenchmarks(entryIds: string[], concurrency: number): Promise<LoadTestResult> {
    console.log(`\n🔄 Testing concurrent benchmark calculations (${entryIds.length} entries, ${concurrency} concurrent)...`);
    
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = Date.now();

    // Process in batches
    for (let i = 0; i < entryIds.length; i += concurrency) {
      const batch = entryIds.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (id) => {
        const opStart = Date.now();
        try {
          await this.benchmarkingEngine.calculateBenchmark(id);
          successful++;
          durations.push(Date.now() - opStart);
        } catch (error) {
          failed++;
          console.error(`Benchmark for ${id} failed:`, error);
        }
      });

      await Promise.all(batchPromises);

      if ((i + concurrency) % 100 === 0) {
        console.log(`  Progress: ${Math.min(i + concurrency, entryIds.length)}/${entryIds.length} benchmarks calculated`);
      }
    }

    const totalDuration = Date.now() - startTime;

    return this.calculateResults('Concurrent Benchmarks', entryIds.length, successful, failed, durations, totalDuration);
  }

  /**
   * Test 3: Complex Filter Queries
   */
  async testComplexFilterQueries(iterations: number, tenantId: string): Promise<LoadTestResult> {
    console.log(`\n🔄 Testing complex filter queries (${iterations} iterations)...`);
    
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = Date.now();

    const filters = [
      { roleStandardized: 'Software Engineer', seniority: 'SENIOR', country: 'USA' },
      { roleStandardized: 'Project Manager', minRate: 800, maxRate: 1200 },
      { country: 'UK', lineOfService: 'Technology' },
      { supplierName: 'Supplier', startDate: new Date('2024-01-01') },
    ];

    for (let i = 0; i < iterations; i++) {
      const filter = filters[i % filters.length];
      const opStart = Date.now();

      try {
        await prisma.rateCardEntry.findMany({
          where: {
            tenantId,
            ...filter,
          },
          take: 50,
        });

        successful++;
      } catch (error) {
        failed++;
        console.error(`Query ${i} failed:`, error);
      }

      durations.push(Date.now() - opStart);
    }

    const totalDuration = Date.now() - startTime;

    return this.calculateResults('Complex Filter Queries', iterations, successful, failed, durations, totalDuration);
  }

  /**
   * Test 4: Cache Performance
   */
  async testCachePerformance(iterations: number, tenantId: string): Promise<LoadTestResult> {
    console.log(`\n🔄 Testing cache performance (${iterations} iterations)...`);
    
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = Date.now();

    const testKey = `test-data-${tenantId}`;

    for (let i = 0; i < iterations; i++) {
      const opStart = Date.now();

      try {
        await this.perfService.withCache(
          testKey,
          async () => {
            // Simulate expensive operation
            return prisma.rateCardEntry.findMany({
              where: { tenantId },
              take: 100,
            });
          },
          { ttl: 60, prefix: 'load-test' }
        );

        successful++;
      } catch (error) {
        failed++;
        console.error(`Cache operation ${i} failed:`, error);
      }

      durations.push(Date.now() - opStart);
    }

    const totalDuration = Date.now() - startTime;
    const cacheStats = this.perfService.getCacheStats();
    console.log(`  Cache hit rate: ${cacheStats.hitRate.toFixed(2)}%`);

    return this.calculateResults('Cache Performance', iterations, successful, failed, durations, totalDuration);
  }

  /**
   * Calculate test results with percentiles
   */
  private calculateResults(
    testName: string,
    total: number,
    successful: number,
    failed: number,
    durations: number[],
    totalDuration: number
  ): LoadTestResult {
    durations.sort((a, b) => a - b);

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    return {
      testName,
      totalOperations: total,
      successfulOperations: successful,
      failedOperations: failed,
      totalDuration,
      averageDuration: avgDuration,
      operationsPerSecond: (successful / totalDuration) * 1000,
      p50: durations[p50Index] || 0,
      p95: durations[p95Index] || 0,
      p99: durations[p99Index] || 0,
    };
  }

  /**
   * Print results
   */
  printResults(result: LoadTestResult) {
    console.log(`\n✅ ${result.testName} Results:`);
    console.log(`  Total Operations: ${result.totalOperations}`);
    console.log(`  Successful: ${result.successfulOperations}`);
    console.log(`  Failed: ${result.failedOperations}`);
    console.log(`  Total Duration: ${result.totalDuration}ms`);
    console.log(`  Average Duration: ${result.averageDuration.toFixed(2)}ms`);
    console.log(`  Operations/sec: ${result.operationsPerSecond.toFixed(2)}`);
    console.log(`  P50: ${result.p50}ms`);
    console.log(`  P95: ${result.p95}ms`);
    console.log(`  P99: ${result.p99}ms`);
  }

  /**
   * Run all load tests
   */
  async runAllTests(tenantId: string) {
    console.log('🚀 Starting Rate Card Load Tests...\n');

    const results: LoadTestResult[] = [];

    // Test 1: Create 1000 entries
    const test1 = await this.testBulkEntryCreation(1000, tenantId);
    this.printResults(test1);
    results.push(test1);

    // Get created entry IDs for benchmark testing
    const entries = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: { id: true },
      take: 500,
    });

    // Test 2: Concurrent benchmarks
    const test2 = await this.testConcurrentBenchmarks(
      entries.map(e => e.id),
      20 // 20 concurrent operations
    );
    this.printResults(test2);
    results.push(test2);

    // Test 3: Complex queries
    const test3 = await this.testComplexFilterQueries(500, tenantId);
    this.printResults(test3);
    results.push(test3);

    // Test 4: Cache performance
    const test4 = await this.testCachePerformance(1000, tenantId);
    this.printResults(test4);
    results.push(test4);

    // Summary
    console.log('\n📊 Load Test Summary:');
    console.log('═══════════════════════════════════════════════════════════');
    results.forEach(result => {
      const successRate = (result.successfulOperations / result.totalOperations * 100).toFixed(2);
      console.log(`${result.testName}:`);
      console.log(`  Success Rate: ${successRate}%`);
      console.log(`  Throughput: ${result.operationsPerSecond.toFixed(2)} ops/sec`);
      console.log(`  P95 Latency: ${result.p95}ms`);
      console.log('');
    });

    return results;
  }

  async cleanup() {
    await this.perfService.cleanup();
    await prisma.$disconnect();
  }
}

// Run load tests if executed directly
if (require.main === module) {
  const tester = new RateCardLoadTester();
  const testTenantId = process.env.TEST_TENANT_ID || 'load-test-tenant';

  tester.runAllTests(testTenantId)
    .then(() => {
      console.log('\n✅ All load tests completed!');
      return tester.cleanup();
    })
    .catch((error) => {
      console.error('\n❌ Load tests failed:', error);
      return tester.cleanup();
    })
    .finally(() => {
      process.exit(0);
    });
}

export { RateCardLoadTester, LoadTestResult };
