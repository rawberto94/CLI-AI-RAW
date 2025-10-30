import autocannon from 'autocannon';
import { performance } from 'perf_hooks';

/**
 * Load testing suite for Rate Card Engine Enhancements
 * Tests system performance under concurrent load
 */

interface LoadTestConfig {
  url: string;
  connections: number;
  duration: number;
  pipelining: number;
}

interface LoadTestResult {
  testName: string;
  requests: number;
  duration: number;
  throughput: number;
  latency: {
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errors: number;
  timeouts: number;
  passed: boolean;
}

class RateCardLoadTester {
  private baseUrl: string;
  private results: LoadTestResult[] = [];

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Run all load tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Rate Card Engine Load Tests\n');

    await this.testBenchmarkCalculation();
    await this.testForecastGeneration();
    await this.testClusterAnalysis();
    await this.testSupplierIntelligence();
    await this.testRealTimeBenchmarking();
    await this.testConcurrentReads();
    await this.testConcurrentWrites();
    await this.testComplexFiltering();

    this.printSummary();
  }

  /**
   * Test 1: Benchmark calculation under load
   */
  private async testBenchmarkCalculation(): Promise<void> {
    console.log('📊 Test 1: Benchmark Calculation');

    const result = await this.runLoadTest({
      name: 'Benchmark Calculation',
      url: `${this.baseUrl}/api/rate-cards/best-rates`,
      connections: 50,
      duration: 30,
      method: 'GET',
      expectedThroughput: 100, // requests/sec
      expectedP95Latency: 500, // ms
    });

    this.results.push(result);
  }

  /**
   * Test 2: Forecast generation
   */
  private async testForecastGeneration(): Promise<void> {
    console.log('📈 Test 2: Forecast Generation');

    const result = await this.runLoadTest({
      name: 'Forecast Generation',
      url: `${this.baseUrl}/api/rate-cards/forecasts`,
      connections: 30,
      duration: 30,
      method: 'GET',
      expectedThroughput: 50,
      expectedP95Latency: 1000,
    });

    this.results.push(result);
  }

  /**
   * Test 3: Cluster analysis
   */
  private async testClusterAnalysis(): Promise<void> {
    console.log('🔍 Test 3: Cluster Analysis');

    const result = await this.runLoadTest({
      name: 'Cluster Analysis',
      url: `${this.baseUrl}/api/rate-cards/clusters`,
      connections: 20,
      duration: 30,
      method: 'GET',
      expectedThroughput: 30,
      expectedP95Latency: 2000,
    });

    this.results.push(result);
  }

  /**
   * Test 4: Supplier intelligence
   */
  private async testSupplierIntelligence(): Promise<void> {
    console.log('🏢 Test 4: Supplier Intelligence');

    const result = await this.runLoadTest({
      name: 'Supplier Intelligence',
      url: `${this.baseUrl}/api/rate-cards/suppliers/rankings`,
      connections: 40,
      duration: 30,
      method: 'GET',
      expectedThroughput: 80,
      expectedP95Latency: 600,
    });

    this.results.push(result);
  }

  /**
   * Test 5: Real-time benchmarking
   */
  private async testRealTimeBenchmarking(): Promise<void> {
    console.log('⚡ Test 5: Real-Time Benchmarking');

    const result = await this.runLoadTest({
      name: 'Real-Time Benchmarking',
      url: `${this.baseUrl}/api/rate-cards/real-time/recalculate`,
      connections: 25,
      duration: 30,
      method: 'POST',
      body: JSON.stringify({ rateCardId: 'test-id' }),
      expectedThroughput: 40,
      expectedP95Latency: 5000, // Real-time target: <5s
    });

    this.results.push(result);
  }

  /**
   * Test 6: Concurrent reads (100+ users)
   */
  private async testConcurrentReads(): Promise<void> {
    console.log('👥 Test 6: Concurrent Reads (100+ users)');

    const result = await this.runLoadTest({
      name: 'Concurrent Reads',
      url: `${this.baseUrl}/api/rate-cards`,
      connections: 100,
      duration: 60,
      method: 'GET',
      expectedThroughput: 200,
      expectedP95Latency: 2000, // Target: <2s
    });

    this.results.push(result);
  }

  /**
   * Test 7: Concurrent writes
   */
  private async testConcurrentWrites(): Promise<void> {
    console.log('✍️ Test 7: Concurrent Writes');

    const result = await this.runLoadTest({
      name: 'Concurrent Writes',
      url: `${this.baseUrl}/api/rate-cards`,
      connections: 20,
      duration: 30,
      method: 'POST',
      body: JSON.stringify({
        role: 'Software Engineer',
        seniority: 'Senior',
        geography: 'US',
        rate: 150,
        currency: 'USD',
      }),
      expectedThroughput: 30,
      expectedP95Latency: 1000,
    });

    this.results.push(result);
  }

  /**
   * Test 8: Complex filtering
   */
  private async testComplexFiltering(): Promise<void> {
    console.log('🔎 Test 8: Complex Filtering');

    const result = await this.runLoadTest({
      name: 'Complex Filtering',
      url: `${this.baseUrl}/api/rate-cards?role=Engineer&geography=US&minRate=100&maxRate=200`,
      connections: 50,
      duration: 30,
      method: 'GET',
      expectedThroughput: 100,
      expectedP95Latency: 500, // Target: <500ms
    });

    this.results.push(result);
  }

  /**
   * Run a single load test
   */
  private async runLoadTest(config: {
    name: string;
    url: string;
    connections: number;
    duration: number;
    method: string;
    body?: string;
    expectedThroughput: number;
    expectedP95Latency: number;
  }): Promise<LoadTestResult> {
    const instance = autocannon({
      url: config.url,
      connections: config.connections,
      duration: config.duration,
      pipelining: 1,
      method: config.method,
      ...(config.body && {
        body: config.body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    });

    return new Promise((resolve) => {
      autocannon.track(instance);

      instance.on('done', (result) => {
        const throughput = result.requests.average;
        const latencyP95 = result.latency.p95;

        const passed =
          throughput >= config.expectedThroughput && latencyP95 <= config.expectedP95Latency;

        const testResult: LoadTestResult = {
          testName: config.name,
          requests: result.requests.total,
          duration: result.duration,
          throughput: throughput,
          latency: {
            mean: result.latency.mean,
            p50: result.latency.p50,
            p95: result.latency.p95,
            p99: result.latency.p99,
          },
          errors: result.errors,
          timeouts: result.timeouts,
          passed,
        };

        console.log(`  Requests: ${testResult.requests}`);
        console.log(`  Throughput: ${testResult.throughput.toFixed(2)} req/sec`);
        console.log(`  Latency P95: ${testResult.latency.p95.toFixed(2)}ms`);
        console.log(`  Status: ${passed ? '✅ PASSED' : '❌ FAILED'}\n`);

        resolve(testResult);
      });
    });
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 LOAD TEST SUMMARY');
    console.log('='.repeat(60) + '\n');

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌\n`);

    console.log('Detailed Results:');
    console.log('-'.repeat(60));

    this.results.forEach((result) => {
      console.log(`\n${result.testName}:`);
      console.log(`  Total Requests: ${result.requests}`);
      console.log(`  Throughput: ${result.throughput.toFixed(2)} req/sec`);
      console.log(`  Latency (mean): ${result.latency.mean.toFixed(2)}ms`);
      console.log(`  Latency (P95): ${result.latency.p95.toFixed(2)}ms`);
      console.log(`  Latency (P99): ${result.latency.p99.toFixed(2)}ms`);
      console.log(`  Errors: ${result.errors}`);
      console.log(`  Timeouts: ${result.timeouts}`);
      console.log(`  Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    });

    console.log('\n' + '='.repeat(60));

    if (failed > 0) {
      console.log('\n⚠️ Some tests failed. Review the results above.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const tester = new RateCardLoadTester(baseUrl);
  tester.runAllTests().catch((error) => {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  });
}

export { RateCardLoadTester };
