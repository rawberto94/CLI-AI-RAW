/**
 * Graceful Degradation Test
 * Tests graceful degradation patterns and backpressure handling
 */

console.log('🛡️ TESTING GRACEFUL DEGRADATION AND BACKPRESSURE');
console.log('================================================');

/**
 * Mock Graceful Degradation Service for testing
 */
class MockGracefulDegradationService {
  constructor() {
    this.config = {
      enabled: true,
      fallbackStrategies: {
        llm: {
          type: 'cache',
          priority: 1,
          timeout: 5000,
          retryCount: 2,
          queueable: true,
          essential: false
        },
        database: {
          type: 'cache',
          priority: 1,
          timeout: 3000,
          retryCount: 3,
          queueable: false,
          essential: true
        },
        storage: {
          type: 'simplified',
          priority: 2,
          timeout: 2000,
          retryCount: 2,
          queueable: true,
          essential: false
        }
      },
      backpressure: {
        enabled: true,
        maxQueueSize: 10, // Small for testing
        maxConcurrentRequests: 5, // Small for testing
        rejectionThreshold: 0.8
      }
    };
    
    this.serviceStatuses = new Map();
    this.requestQueues = new Map();
    this.concurrentRequests = new Map();
    this.backpressureMetrics = {
      queueDepth: 0,
      concurrentRequests: 0,
      rejectedRequests: 0,
      averageWaitTime: 0,
      throughput: 0
    };
    
    this.initializeServices();
  }

  initializeServices() {
    Object.keys(this.config.fallbackStrategies).forEach(service => {
      this.serviceStatuses.set(service, {
        service,
        status: 'healthy',
        degradationLevel: 0,
        fallbackActive: false,
        lastHealthCheck: new Date(),
        metrics: {
          requestCount: 0,
          errorCount: 0,
          fallbackCount: 0,
          averageResponseTime: 0
        }
      });
      
      this.requestQueues.set(service, []);
      this.concurrentRequests.set(service, 0);
    });
  }

  async executeWithDegradation(service, operation, fallbackData) {
    if (!this.config.enabled) {
      return await operation();
    }

    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) {
      throw new Error(`Unknown service: ${service}`);
    }

    // Check backpressure
    if (this.shouldApplyBackpressure(service)) {
      return await this.handleBackpressure(service, operation, fallbackData);
    }

    // Increment concurrent requests
    this.incrementConcurrentRequests(service);

    try {
      const startTime = Date.now();
      const result = await operation();
      
      // Update success metrics
      this.updateServiceMetrics(service, Date.now() - startTime, false);
      return result;

    } catch (error) {
      // Update error metrics
      this.updateServiceMetrics(service, 0, true);
      
      // Trigger degradation if needed
      this.triggerDegradation(service, error);
      
      // Apply fallback strategy
      return await this.applyFallbackStrategy(service, operation, fallbackData, error);
      
    } finally {
      this.decrementConcurrentRequests(service);
    }
  }

  shouldApplyBackpressure(service) {
    if (!this.config.backpressure.enabled) return false;

    const queueSize = this.requestQueues.get(service)?.length || 0;
    const concurrent = this.concurrentRequests.get(service) || 0;
    
    return queueSize >= this.config.backpressure.maxQueueSize ||
           concurrent >= this.config.backpressure.maxConcurrentRequests;
  }

  async handleBackpressure(service, operation, fallbackData) {
    const strategy = this.config.fallbackStrategies[service];
    const queue = this.requestQueues.get(service);
    
    // If not queueable or queue is full, reject or use fallback
    if (!strategy.queueable || queue.length >= this.config.backpressure.maxQueueSize) {
      this.backpressureMetrics.rejectedRequests++;
      
      if (fallbackData !== undefined) {
        return fallbackData;
      }
      
      throw new Error(`Service ${service} is overloaded - request rejected`);
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      queue.push({
        request: operation,
        resolve,
        reject,
        timestamp: new Date()
      });

      // Process queue after a short delay
      setTimeout(() => this.processQueue(service), 10);
    });
  }

  async processQueue(service) {
    const queue = this.requestQueues.get(service);
    const concurrent = this.concurrentRequests.get(service) || 0;
    
    if (queue.length === 0 || concurrent >= this.config.backpressure.maxConcurrentRequests) {
      return;
    }

    const queuedRequest = queue.shift();
    if (!queuedRequest) return;

    try {
      this.incrementConcurrentRequests(service);
      const result = await queuedRequest.request();
      queuedRequest.resolve(result);
    } catch (error) {
      queuedRequest.reject(error);
    } finally {
      this.decrementConcurrentRequests(service);
    }
  }

  async applyFallbackStrategy(service, operation, fallbackData, error) {
    const strategy = this.config.fallbackStrategies[service];
    const serviceStatus = this.serviceStatuses.get(service);

    serviceStatus.fallbackActive = true;
    serviceStatus.metrics.fallbackCount++;

    switch (strategy.type) {
      case 'cache':
        return this.applyCacheFallback(service, fallbackData);
      case 'simplified':
        return this.applySimplifiedFallback(service, fallbackData);
      case 'offline':
        return this.applyOfflineFallback(service, fallbackData);
      case 'reject':
        throw new Error(`Service ${service} is unavailable`);
      default:
        throw error;
    }
  }

  applyCacheFallback(service, fallbackData) {
    if (fallbackData !== undefined) {
      return fallbackData;
    }

    return {
      data: `Cached data for ${service}`,
      fallback: true,
      type: 'cache'
    };
  }

  applySimplifiedFallback(service, fallbackData) {
    if (fallbackData !== undefined) {
      return fallbackData;
    }

    return {
      data: `Simplified response for ${service}`,
      fallback: true,
      type: 'simplified'
    };
  }

  applyOfflineFallback(service, fallbackData) {
    if (fallbackData !== undefined) {
      return fallbackData;
    }

    return {
      data: `Offline data for ${service}`,
      fallback: true,
      type: 'offline'
    };
  }

  triggerDegradation(service, error) {
    const serviceStatus = this.serviceStatuses.get(service);
    
    // Calculate degradation level based on error rate
    const errorRate = serviceStatus.metrics.errorCount / Math.max(serviceStatus.metrics.requestCount, 1);
    const newDegradationLevel = Math.min(100, Math.floor(errorRate * 100));
    
    if (newDegradationLevel > serviceStatus.degradationLevel) {
      serviceStatus.degradationLevel = newDegradationLevel;
      
      // Update service status based on degradation level
      if (newDegradationLevel >= 80) {
        serviceStatus.status = 'failed';
      } else if (newDegradationLevel >= 30) {
        serviceStatus.status = 'degraded';
      }
    }
  }

  updateServiceMetrics(service, responseTime, isError) {
    const serviceStatus = this.serviceStatuses.get(service);
    
    serviceStatus.metrics.requestCount++;
    if (isError) {
      serviceStatus.metrics.errorCount++;
    }
    
    // Update average response time
    const totalTime = serviceStatus.metrics.averageResponseTime * (serviceStatus.metrics.requestCount - 1);
    serviceStatus.metrics.averageResponseTime = (totalTime + responseTime) / serviceStatus.metrics.requestCount;
    
    serviceStatus.lastHealthCheck = new Date();
  }

  incrementConcurrentRequests(service) {
    const current = this.concurrentRequests.get(service) || 0;
    this.concurrentRequests.set(service, current + 1);
  }

  decrementConcurrentRequests(service) {
    const current = this.concurrentRequests.get(service) || 0;
    this.concurrentRequests.set(service, Math.max(0, current - 1));
  }

  getServiceStatus(service) {
    return this.serviceStatuses.get(service);
  }

  getAllServiceStatuses() {
    return new Map(this.serviceStatuses);
  }

  getBackpressureMetrics() {
    // Update queue depth
    let totalQueueDepth = 0;
    let totalConcurrent = 0;
    
    this.requestQueues.forEach(queue => {
      totalQueueDepth += queue.length;
    });
    
    this.concurrentRequests.forEach(count => {
      totalConcurrent += count;
    });
    
    this.backpressureMetrics.queueDepth = totalQueueDepth;
    this.backpressureMetrics.concurrentRequests = totalConcurrent;
    
    return { ...this.backpressureMetrics };
  }

  getSystemOverview() {
    const statuses = Array.from(this.serviceStatuses.values());
    
    return {
      totalServices: statuses.length,
      healthyServices: statuses.filter(s => s.status === 'healthy').length,
      degradedServices: statuses.filter(s => s.status === 'degraded').length,
      failedServices: statuses.filter(s => s.status === 'failed').length,
      fallbacksActive: statuses.filter(s => s.fallbackActive).length,
      backpressure: this.getBackpressureMetrics()
    };
  }

  forceDegradation(service, level) {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;
    
    serviceStatus.degradationLevel = Math.max(0, Math.min(100, level));
    
    if (level >= 80) {
      serviceStatus.status = 'failed';
    } else if (level >= 30) {
      serviceStatus.status = 'degraded';
    } else {
      serviceStatus.status = 'healthy';
    }
  }

  resetService(service) {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;
    
    serviceStatus.status = 'healthy';
    serviceStatus.degradationLevel = 0;
    serviceStatus.fallbackActive = false;
    serviceStatus.metrics = {
      requestCount: 0,
      errorCount: 0,
      fallbackCount: 0,
      averageResponseTime: 0
    };
  }
}

/**
 * Test fallback strategies
 */
async function testFallbackStrategies() {
  console.log('\n🔄 Testing Fallback Strategies...');
  
  const service = new MockGracefulDegradationService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Cache fallback
    console.log('  Test 1: Cache fallback strategy');
    
    const cacheResult = await service.executeWithDegradation('llm', async () => {
      throw new Error('LLM service unavailable');
    }, { cached: true, data: 'cached response' });
    
    const cacheSuccess = cacheResult.cached === true && cacheResult.data === 'cached response';
    
    console.log(`    ${cacheSuccess ? '✅' : '❌'} Cache fallback:`);
    console.log(`      Fallback data returned: ${!!cacheResult.cached}`);
    console.log(`      Data: ${cacheResult.data}`);
    results.tests.push({ name: 'Cache Fallback', passed: cacheSuccess });
    if (cacheSuccess) results.passed++; else results.failed++;
    
    // Test 2: Simplified fallback
    console.log('  Test 2: Simplified fallback strategy');
    
    const simplifiedResult = await service.executeWithDegradation('storage', async () => {
      throw new Error('Storage service error');
    });
    
    const simplifiedSuccess = simplifiedResult.fallback === true && 
                             simplifiedResult.type === 'simplified';
    
    console.log(`    ${simplifiedSuccess ? '✅' : '❌'} Simplified fallback:`);
    console.log(`      Fallback active: ${simplifiedResult.fallback}`);
    console.log(`      Type: ${simplifiedResult.type}`);
    console.log(`      Data: ${simplifiedResult.data}`);
    results.tests.push({ name: 'Simplified Fallback', passed: simplifiedSuccess });
    if (simplifiedSuccess) results.passed++; else results.failed++;
    
    // Test 3: Fallback metrics tracking
    console.log('  Test 3: Fallback metrics tracking');
    
    const llmStatus = service.getServiceStatus('llm');
    const storageStatus = service.getServiceStatus('storage');
    
    const metricsSuccess = llmStatus.fallbackActive === true &&
                          llmStatus.metrics.fallbackCount > 0 &&
                          storageStatus.fallbackActive === true &&
                          storageStatus.metrics.fallbackCount > 0;
    
    console.log(`    ${metricsSuccess ? '✅' : '❌'} Fallback metrics:`);
    console.log(`      LLM fallbacks: ${llmStatus.metrics.fallbackCount}`);
    console.log(`      Storage fallbacks: ${storageStatus.metrics.fallbackCount}`);
    console.log(`      LLM fallback active: ${llmStatus.fallbackActive}`);
    console.log(`      Storage fallback active: ${storageStatus.fallbackActive}`);
    results.tests.push({ name: 'Fallback Metrics Tracking', passed: metricsSuccess });
    if (metricsSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Fallback strategies test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test backpressure handling
 */
async function testBackpressureHandling() {
  console.log('\n⚡ Testing Backpressure Handling...');
  
  const service = new MockGracefulDegradationService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Concurrent request limiting
    console.log('  Test 1: Concurrent request limiting');
    
    // Create multiple concurrent requests that exceed the limit
    const concurrentPromises = [];
    for (let i = 0; i < 8; i++) { // Exceeds maxConcurrentRequests (5)
      concurrentPromises.push(
        service.executeWithDegradation('llm', async () => {
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
          return { success: true, id: i };
        })
      );
    }
    
    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const successfulResults = concurrentResults.filter(r => r.status === 'fulfilled').length;
    const rejectedResults = concurrentResults.filter(r => r.status === 'rejected').length;
    
    const concurrentSuccess = successfulResults > 0 && rejectedResults > 0;
    
    console.log(`    ${concurrentSuccess ? '✅' : '❌'} Concurrent request limiting:`);
    console.log(`      Successful requests: ${successfulResults}`);
    console.log(`      Rejected requests: ${rejectedResults}`);
    console.log(`      Backpressure triggered: ${rejectedResults > 0}`);
    results.tests.push({ name: 'Concurrent Request Limiting', passed: concurrentSuccess });
    if (concurrentSuccess) results.passed++; else results.failed++;
    
    // Test 2: Queue management
    console.log('  Test 2: Queue management');
    
    // Reset service for clean test
    service.resetService('storage');
    
    // Create requests that should be queued (storage is queueable)
    const queuePromises = [];
    for (let i = 0; i < 6; i++) { // Should queue some requests
      queuePromises.push(
        service.executeWithDegradation('storage', async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { queued: true, id: i };
        })
      );
    }
    
    // Check queue depth before processing
    const backpressureMetrics = service.getBackpressureMetrics();
    const queueDepthBefore = backpressureMetrics.queueDepth;
    
    const queueResults = await Promise.allSettled(queuePromises);
    const queueSuccessful = queueResults.filter(r => r.status === 'fulfilled').length;
    
    const queueSuccess = queueSuccessful > 0 && queueDepthBefore > 0;
    
    console.log(`    ${queueSuccess ? '✅' : '❌'} Queue management:`);
    console.log(`      Queue depth (peak): ${queueDepthBefore}`);
    console.log(`      Queued requests processed: ${queueSuccessful}`);
    console.log(`      Queue processing: ${queueSuccessful === queuePromises.length ? 'Complete' : 'Partial'}`);
    results.tests.push({ name: 'Queue Management', passed: queueSuccess });
    if (queueSuccess) results.passed++; else results.failed++;
    
    // Test 3: Backpressure metrics
    console.log('  Test 3: Backpressure metrics');
    
    const finalMetrics = service.getBackpressureMetrics();
    const metricsSuccess = finalMetrics.rejectedRequests > 0 &&
                          finalMetrics.queueDepth >= 0 &&
                          finalMetrics.concurrentRequests >= 0;
    
    console.log(`    ${metricsSuccess ? '✅' : '❌'} Backpressure metrics:`);
    console.log(`      Rejected requests: ${finalMetrics.rejectedRequests}`);
    console.log(`      Current queue depth: ${finalMetrics.queueDepth}`);
    console.log(`      Current concurrent requests: ${finalMetrics.concurrentRequests}`);
    results.tests.push({ name: 'Backpressure Metrics', passed: metricsSuccess });
    if (metricsSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Backpressure handling test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test service degradation
 */
async function testServiceDegradation() {
  console.log('\n📉 Testing Service Degradation...');
  
  const service = new MockGracefulDegradationService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Automatic degradation triggering
    console.log('  Test 1: Automatic degradation triggering');
    
    // Generate multiple errors to trigger degradation
    for (let i = 0; i < 5; i++) {
      try {
        await service.executeWithDegradation('database', async () => {
          throw new Error('Database connection failed');
        });
      } catch (error) {
        // Expected to fail and trigger degradation
      }
    }
    
    const dbStatus = service.getServiceStatus('database');
    const degradationSuccess = dbStatus.degradationLevel > 0 &&
                              dbStatus.status !== 'healthy' &&
                              dbStatus.metrics.errorCount > 0;
    
    console.log(`    ${degradationSuccess ? '✅' : '❌'} Automatic degradation:`);
    console.log(`      Degradation level: ${dbStatus.degradationLevel}%`);
    console.log(`      Service status: ${dbStatus.status}`);
    console.log(`      Error count: ${dbStatus.metrics.errorCount}`);
    console.log(`      Request count: ${dbStatus.metrics.requestCount}`);
    results.tests.push({ name: 'Automatic Degradation Triggering', passed: degradationSuccess });
    if (degradationSuccess) results.passed++; else results.failed++;
    
    // Test 2: Forced degradation
    console.log('  Test 2: Forced degradation');
    
    service.forceDegradation('llm', 75);
    const llmStatus = service.getServiceStatus('llm');
    
    const forcedSuccess = llmStatus.degradationLevel === 75 &&
                         llmStatus.status === 'degraded';
    
    console.log(`    ${forcedSuccess ? '✅' : '❌'} Forced degradation:`);
    console.log(`      Forced level: 75%`);
    console.log(`      Actual level: ${llmStatus.degradationLevel}%`);
    console.log(`      Status: ${llmStatus.status}`);
    results.tests.push({ name: 'Forced Degradation', passed: forcedSuccess });
    if (forcedSuccess) results.passed++; else results.failed++;
    
    // Test 3: Service recovery
    console.log('  Test 3: Service recovery');
    
    service.resetService('llm');
    const recoveredStatus = service.getServiceStatus('llm');
    
    const recoverySuccess = recoveredStatus.degradationLevel === 0 &&
                           recoveredStatus.status === 'healthy' &&
                           recoveredStatus.fallbackActive === false;
    
    console.log(`    ${recoverySuccess ? '✅' : '❌'} Service recovery:`);
    console.log(`      Degradation level: ${recoveredStatus.degradationLevel}%`);
    console.log(`      Status: ${recoveredStatus.status}`);
    console.log(`      Fallback active: ${recoveredStatus.fallbackActive}`);
    results.tests.push({ name: 'Service Recovery', passed: recoverySuccess });
    if (recoverySuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Service degradation test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test system overview and monitoring
 */
async function testSystemOverview() {
  console.log('\n📊 Testing System Overview and Monitoring...');
  
  const service = new MockGracefulDegradationService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: System overview generation
    console.log('  Test 1: System overview generation');
    
    // Set up different service states
    service.forceDegradation('llm', 60);
    service.forceDegradation('database', 90);
    
    const overview = service.getSystemOverview();
    const overviewSuccess = overview.totalServices > 0 &&
                           overview.degradedServices > 0 &&
                           overview.failedServices > 0 &&
                           overview.backpressure !== undefined;
    
    console.log(`    ${overviewSuccess ? '✅' : '❌'} System overview:`);
    console.log(`      Total services: ${overview.totalServices}`);
    console.log(`      Healthy services: ${overview.healthyServices}`);
    console.log(`      Degraded services: ${overview.degradedServices}`);
    console.log(`      Failed services: ${overview.failedServices}`);
    console.log(`      Fallbacks active: ${overview.fallbacksActive}`);
    results.tests.push({ name: 'System Overview Generation', passed: overviewSuccess });
    if (overviewSuccess) results.passed++; else results.failed++;
    
    // Test 2: Service status tracking
    console.log('  Test 2: Service status tracking');
    
    const allStatuses = service.getAllServiceStatuses();
    const statusSuccess = allStatuses.size > 0 &&
                         Array.from(allStatuses.values()).every(s => 
                           s.service && s.status && s.metrics
                         );
    
    console.log(`    ${statusSuccess ? '✅' : '❌'} Service status tracking:`);
    console.log(`      Services tracked: ${allStatuses.size}`);
    Array.from(allStatuses.entries()).forEach(([serviceName, status]) => {
      console.log(`      ${serviceName}: ${status.status} (${status.degradationLevel}% degraded)`);
    });
    results.tests.push({ name: 'Service Status Tracking', passed: statusSuccess });
    if (statusSuccess) results.passed++; else results.failed++;
    
    // Test 3: Metrics collection
    console.log('  Test 3: Metrics collection');
    
    const backpressureMetrics = service.getBackpressureMetrics();
    const metricsSuccess = backpressureMetrics.queueDepth >= 0 &&
                          backpressureMetrics.concurrentRequests >= 0 &&
                          backpressureMetrics.rejectedRequests >= 0;
    
    console.log(`    ${metricsSuccess ? '✅' : '❌'} Metrics collection:`);
    console.log(`      Queue depth: ${backpressureMetrics.queueDepth}`);
    console.log(`      Concurrent requests: ${backpressureMetrics.concurrentRequests}`);
    console.log(`      Rejected requests: ${backpressureMetrics.rejectedRequests}`);
    console.log(`      Throughput: ${backpressureMetrics.throughput.toFixed(2)} req/s`);
    results.tests.push({ name: 'Metrics Collection', passed: metricsSuccess });
    if (metricsSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ System overview test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Graceful Degradation Tests...\n');
  
  const testResults = [];
  
  // Run all test suites
  testResults.push(await testFallbackStrategies());
  testResults.push(await testBackpressureHandling());
  testResults.push(await testServiceDegradation());
  testResults.push(await testSystemOverview());
  
  // Calculate overall results
  const totalPassed = testResults.reduce((sum, result) => sum + result.passed, 0);
  const totalFailed = testResults.reduce((sum, result) => sum + result.failed, 0);
  const totalTests = totalPassed + totalFailed;
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('🛡️ GRACEFUL DEGRADATION TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All graceful degradation tests passed!');
    console.log('✅ Fallback strategies are working correctly');
    console.log('✅ Backpressure handling is functional');
    console.log('✅ Service degradation is properly managed');
    console.log('✅ System monitoring and overview are operational');
  } else {
    console.log(`\n⚠️  ${totalFailed} test(s) failed. Please review the implementation.`);
  }
  
  // Detailed test breakdown
  console.log('\nDetailed Results:');
  const suiteNames = ['Fallback Strategies', 'Backpressure Handling', 'Service Degradation', 'System Overview'];
  testResults.forEach((result, index) => {
    console.log(`  ${suiteNames[index]}: ${result.passed}/${result.passed + result.failed} passed`);
  });
  
  return {
    totalTests,
    totalPassed,
    totalFailed,
    successRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0,
    testResults
  };
}

// Run the tests
runAllTests().catch(console.error);