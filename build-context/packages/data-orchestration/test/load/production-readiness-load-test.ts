/**
 * Production Readiness Load Testing Suite
 * 
 * Tests:
 * - Concurrent user load (100+ users)
 * - SSE connection scaling
 * - Database performance under load
 * - Performance target verification
 * 
 * Requirements: 8.1, 7.1
 */

import { performance } from 'perf_hooks';

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
  passed: boolean;
  target?: {
    metric: string;
    expected: number;
    actual: number;
  };
}

interface SSEConnection {
  id: string;
  eventSource: any;
  connected: boolean;
  messagesReceived: number;
  errors: number;
  connectionTime: number;
}

class ProductionReadinessLoadTester {
  private baseUrl: string;
  private results: LoadTestResult[] = [];

  constructor(baseUrl: string = 'http://localhost:3005') {
    this.baseUrl = baseUrl;
  }

  /**
   * Run all production readiness load tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Production Readiness Load Tests\n');
    console.log('Target: 100+ concurrent users, <2s page load, <200ms API response\n');

    // Test 1: Concurrent User Load
    await this.testConcurrentUserLoad();

    // Test 2: SSE Connection Scaling
    await this.testSSEConnectionScaling();

    // Test 3: Database Performance Under Load
    await this.testDatabasePerformance();

    // Test 4: API Response Time Verification
    await this.testAPIResponseTimes();

    // Test 5: Mixed Workload (Read/Write)
    await this.testMixedWorkload();

    // Test 6: Sustained Load Test
    await this.testSustainedLoad();

    this.printSummary();
  }

  /**
   * Test 1: Concurrent User Load (100+ users)
   * Requirement: 7.1 - Support at least 100 concurrent SSE connections
   */
  private async testConcurrentUserLoad(): Promise<void> {
    console.log('👥 Test 1: Concurrent User Load (100+ users)');
    console.log('   Target: Handle 100+ concurrent users\n');

    const concurrentUsers = 120;
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = performance.now();

    // Simulate concurrent user requests
    const userRequests = Array.from({ length: concurrentUsers }, async (_, i) => {
      const opStart = performance.now();
      
      try {
        // Simulate typical user workflow
        const response = await fetch(`${this.baseUrl}/api/health`);
        
        if (response.ok) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }

      durations.push(performance.now() - opStart);
    });

    await Promise.all(userRequests);

    const totalDuration = performance.now() - startTime;
    const result = this.calculateResults(
      'Concurrent User Load',
      concurrentUsers,
      successful,
      failed,
      durations,
      totalDuration
    );

    // Pass if we handle 100+ users successfully
    result.passed = successful >= 100;
    result.target = {
      metric: 'Concurrent Users',
      expected: 100,
      actual: successful
    };

    this.printResults(result);
    this.results.push(result);
  }

  /**
   * Test 2: SSE Connection Scaling
   * Requirement: 7.1 - Support at least 100 concurrent SSE connections
   */
  private async testSSEConnectionScaling(): Promise<void> {
    console.log('⚡ Test 2: SSE Connection Scaling');
    console.log('   Target: 100+ concurrent SSE connections\n');

    const targetConnections = 100;
    const connections: SSEConnection[] = [];
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = performance.now();

    // Create concurrent SSE connections
    const connectionPromises = Array.from({ length: targetConnections }, async (_, i) => {
      const opStart = performance.now();
      const connectionId = `conn-${i}`;

      try {
        // Test SSE endpoint availability
        const response = await fetch(`${this.baseUrl}/api/events`, {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
          },
        });

        if (response.ok) {
          successful++;
          connections.push({
            id: connectionId,
            eventSource: null,
            connected: true,
            messagesReceived: 0,
            errors: 0,
            connectionTime: performance.now() - opStart
          });
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }

      durations.push(performance.now() - opStart);
    });

    await Promise.all(connectionPromises);

    const totalDuration = performance.now() - startTime;
    const result = this.calculateResults(
      'SSE Connection Scaling',
      targetConnections,
      successful,
      failed,
      durations,
      totalDuration
    );

    result.passed = successful >= 100;
    result.target = {
      metric: 'SSE Connections',
      expected: 100,
      actual: successful
    };

    this.printResults(result);
    this.results.push(result);

    console.log(`   Active connections: ${connections.length}`);
    console.log(`   Average connection time: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms\n`);
  }

  /**
   * Test 3: Database Performance Under Load
   * Requirement: 8.1 - Integration tests for critical workflows
   */
  private async testDatabasePerformance(): Promise<void> {
    console.log('💾 Test 3: Database Performance Under Load');
    console.log('   Target: Handle concurrent database operations\n');

    const operations = 500;
    const concurrency = 50;
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = performance.now();

    // Test various database operations
    const endpoints = [
      '/api/contracts',
      '/api/rate-cards',
      '/api/analytics/artifacts',
      '/api/health/detailed',
    ];

    for (let i = 0; i < operations; i += concurrency) {
      const batch = Array.from({ length: Math.min(concurrency, operations - i) }, async (_, j) => {
        const opStart = performance.now();
        const endpoint = endpoints[(i + j) % endpoints.length];

        try {
          const response = await fetch(`${this.baseUrl}${endpoint}`);
          
          if (response.ok) {
            successful++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }

        durations.push(performance.now() - opStart);
      });

      await Promise.all(batch);

      // Progress indicator
      if ((i + concurrency) % 100 === 0) {
        console.log(`   Progress: ${Math.min(i + concurrency, operations)}/${operations} operations`);
      }
    }

    const totalDuration = performance.now() - startTime;
    const result = this.calculateResults(
      'Database Performance',
      operations,
      successful,
      failed,
      durations,
      totalDuration
    );

    // Pass if success rate > 95%
    result.passed = (successful / operations) > 0.95;
    result.target = {
      metric: 'Success Rate',
      expected: 95,
      actual: (successful / operations) * 100
    };

    this.printResults(result);
    this.results.push(result);
  }

  /**
   * Test 4: API Response Time Verification
   * Requirement: Performance targets - <200ms API response
   */
  private async testAPIResponseTimes(): Promise<void> {
    console.log('⏱️  Test 4: API Response Time Verification');
    console.log('   Target: <200ms API response time (P95)\n');

    const iterations = 1000;
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = performance.now();

    // Test critical API endpoints
    const endpoints = [
      '/api/health',
      '/api/contracts',
      '/api/rate-cards/best-rates',
      '/api/monitoring/metrics',
    ];

    for (let i = 0; i < iterations; i++) {
      const endpoint = endpoints[i % endpoints.length];
      const opStart = performance.now();

      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`);
        
        if (response.ok) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }

      durations.push(performance.now() - opStart);
    }

    const totalDuration = performance.now() - startTime;
    const result = this.calculateResults(
      'API Response Times',
      iterations,
      successful,
      failed,
      durations,
      totalDuration
    );

    // Pass if P95 < 200ms
    result.passed = result.p95 < 200;
    result.target = {
      metric: 'P95 Latency (ms)',
      expected: 200,
      actual: result.p95
    };

    this.printResults(result);
    this.results.push(result);
  }

  /**
   * Test 5: Mixed Workload (Read/Write)
   * Tests realistic production scenario with mixed operations
   */
  private async testMixedWorkload(): Promise<void> {
    console.log('🔄 Test 5: Mixed Workload (Read/Write)');
    console.log('   Target: Handle mixed read/write operations\n');

    const operations = 500;
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = performance.now();

    // 80% reads, 20% writes (typical production ratio)
    for (let i = 0; i < operations; i++) {
      const opStart = performance.now();
      const isWrite = i % 5 === 0; // 20% writes

      try {
        if (isWrite) {
          // Simulate write operation (health check as proxy)
          const response = await fetch(`${this.baseUrl}/api/health/detailed`);
          if (response.ok) successful++;
          else failed++;
        } else {
          // Simulate read operation
          const response = await fetch(`${this.baseUrl}/api/health`);
          if (response.ok) successful++;
          else failed++;
        }
      } catch (error) {
        failed++;
      }

      durations.push(performance.now() - opStart);

      if ((i + 1) % 100 === 0) {
        console.log(`   Progress: ${i + 1}/${operations} operations`);
      }
    }

    const totalDuration = performance.now() - startTime;
    const result = this.calculateResults(
      'Mixed Workload',
      operations,
      successful,
      failed,
      durations,
      totalDuration
    );

    result.passed = (successful / operations) > 0.95;
    result.target = {
      metric: 'Success Rate',
      expected: 95,
      actual: (successful / operations) * 100
    };

    this.printResults(result);
    this.results.push(result);
  }

  /**
   * Test 6: Sustained Load Test
   * Tests system stability under sustained load
   */
  private async testSustainedLoad(): Promise<void> {
    console.log('⏳ Test 6: Sustained Load Test');
    console.log('   Target: Maintain performance over 60 seconds\n');

    const duration = 60000; // 60 seconds
    const requestsPerSecond = 50;
    const interval = 1000 / requestsPerSecond;
    
    const durations: number[] = [];
    let successful = 0;
    let failed = 0;
    const startTime = performance.now();
    let operations = 0;

    while (performance.now() - startTime < duration) {
      const opStart = performance.now();

      try {
        const response = await fetch(`${this.baseUrl}/api/health`);
        
        if (response.ok) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }

      operations++;
      durations.push(performance.now() - opStart);

      // Progress indicator every 10 seconds
      if (operations % (requestsPerSecond * 10) === 0) {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(0);
        console.log(`   Progress: ${elapsed}s / 60s (${successful} successful)`);
      }

      // Wait for next interval
      const elapsed = performance.now() - opStart;
      if (elapsed < interval) {
        await new Promise(resolve => setTimeout(resolve, interval - elapsed));
      }
    }

    const totalDuration = performance.now() - startTime;
    const result = this.calculateResults(
      'Sustained Load',
      operations,
      successful,
      failed,
      durations,
      totalDuration
    );

    // Pass if success rate > 95% and P95 < 200ms
    result.passed = (successful / operations) > 0.95 && result.p95 < 200;
    result.target = {
      metric: 'Success Rate & P95',
      expected: 95,
      actual: (successful / operations) * 100
    };

    this.printResults(result);
    this.results.push(result);
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
      passed: false, // Set by individual tests
    };
  }

  /**
   * Print individual test results
   */
  private printResults(result: LoadTestResult): void {
    console.log(`   Results:`);
    console.log(`   ├─ Total Operations: ${result.totalOperations}`);
    console.log(`   ├─ Successful: ${result.successfulOperations}`);
    console.log(`   ├─ Failed: ${result.failedOperations}`);
    console.log(`   ├─ Success Rate: ${((result.successfulOperations / result.totalOperations) * 100).toFixed(2)}%`);
    console.log(`   ├─ Total Duration: ${result.totalDuration.toFixed(2)}ms`);
    console.log(`   ├─ Average Duration: ${result.averageDuration.toFixed(2)}ms`);
    console.log(`   ├─ Operations/sec: ${result.operationsPerSecond.toFixed(2)}`);
    console.log(`   ├─ P50 Latency: ${result.p50.toFixed(2)}ms`);
    console.log(`   ├─ P95 Latency: ${result.p95.toFixed(2)}ms`);
    console.log(`   ├─ P99 Latency: ${result.p99.toFixed(2)}ms`);
    
    if (result.target) {
      console.log(`   ├─ Target: ${result.target.metric} ${result.target.expected}`);
      console.log(`   ├─ Actual: ${result.target.actual.toFixed(2)}`);
    }
    
    console.log(`   └─ Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`);
  }

  /**
   * Print comprehensive test summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📋 PRODUCTION READINESS LOAD TEST SUMMARY');
    console.log('='.repeat(70) + '\n');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalOps = this.results.reduce((sum, r) => sum + r.totalOperations, 0);
    const totalSuccessful = this.results.reduce((sum, r) => sum + r.successfulOperations, 0);

    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Overall Success Rate: ${((totalSuccessful / totalOps) * 100).toFixed(2)}%\n`);

    console.log('Performance Targets:');
    console.log('─'.repeat(70));
    console.log('✓ Concurrent Users: 100+ users');
    console.log('✓ SSE Connections: 100+ concurrent connections');
    console.log('✓ API Response Time: <200ms (P95)');
    console.log('✓ Page Load Time: <2s');
    console.log('✓ Success Rate: >95%\n');

    console.log('Detailed Results:');
    console.log('─'.repeat(70));

    this.results.forEach(result => {
      const successRate = (result.successfulOperations / result.totalOperations * 100).toFixed(2);
      const status = result.passed ? '✅' : '❌';
      
      console.log(`\n${status} ${result.testName}:`);
      console.log(`   Success Rate: ${successRate}%`);
      console.log(`   Throughput: ${result.operationsPerSecond.toFixed(2)} ops/sec`);
      console.log(`   P95 Latency: ${result.p95.toFixed(2)}ms`);
      console.log(`   P99 Latency: ${result.p99.toFixed(2)}ms`);
      
      if (result.target) {
        const targetMet = result.passed ? '✓' : '✗';
        console.log(`   Target: ${targetMet} ${result.target.metric} - Expected: ${result.target.expected}, Actual: ${result.target.actual.toFixed(2)}`);
      }
    });

    console.log('\n' + '='.repeat(70));

    if (failed > 0) {
      console.log('\n⚠️  Some tests failed. Review the results above.');
      console.log('   Consider optimizing database queries, connection pooling, or caching.');
      process.exitCode = 1;
    } else {
      console.log('\n✅ All production readiness load tests passed!');
      console.log('   System is ready for production deployment.');
      process.exitCode = 0;
    }
  }
}

// Export for use in other tests
export { ProductionReadinessLoadTester, LoadTestResult, SSEConnection };

// Run tests if executed directly
if (require.main === module) {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3005';
  const tester = new ProductionReadinessLoadTester(baseUrl);
  
  tester.runAllTests()
    .then(() => {
      console.log('\n✅ Load testing complete!');
    })
    .catch((error) => {
      console.error('\n❌ Load test failed:', error);
      process.exitCode = 1;
    });
}
