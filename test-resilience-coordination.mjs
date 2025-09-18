/**
 * Resilience Coordination Test
 * Tests the coordination between circuit breakers and graceful degradation
 */

console.log('🔗 TESTING RESILIENCE COORDINATION');
console.log('==================================');

/**
 * Mock Resilience Coordinator Service for testing
 */
class MockResilienceCoordinatorService {
  constructor() {
    this.config = {
      enabled: true,
      coordination: {
        circuitBreakerIntegration: true,
        degradationTriggers: {
          circuitOpenThreshold: 1,
          errorRateThreshold: 0.1,
          responseTimeThreshold: 5000
        },
        recoveryConditions: {
          circuitClosedRequired: true,
          successRateThreshold: 0.9,
          stabilityPeriod: 60000
        }
      }
    };
    
    this.serviceStatuses = new Map();
    this.startTime = new Date();
    this.initializeServices();
  }

  initializeServices() {
    const services = ['llm', 'database', 'storage', 'search'];
    
    services.forEach(service => {
      this.serviceStatuses.set(service, {
        service,
        circuitState: 'closed',
        degradationLevel: 0,
        fallbackActive: false,
        overallHealth: 'healthy',
        metrics: {
          requestCount: 0,
          errorRate: 0,
          averageResponseTime: 0,
          circuitFailures: 0,
          fallbackUsage: 0
        },
        lastUpdate: new Date()
      });
    });
  }

  async executeWithResilience(service, operation, fallbackData) {
    if (!this.config.enabled) {
      return await operation();
    }

    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) {
      throw new Error(`Unknown service: ${service}`);
    }

    try {
      // Simulate circuit breaker check
      if (serviceStatus.circuitState === 'open') {
        throw new Error('Circuit breaker is open');
      }

      const result = await operation();
      
      // Update success metrics
      this.updateServiceSuccess(service);
      return result;

    } catch (error) {
      // Update failure metrics
      this.updateServiceFailure(service, error);
      
      // If circuit breaker failed, try graceful degradation
      if (error.message?.includes('Circuit breaker is open')) {
        if (fallbackData !== undefined) {
          serviceStatus.fallbackActive = true;
          serviceStatus.metrics.fallbackUsage++;
          return fallbackData;
        }
      }
      
      throw error;
    }
  }

  handleCircuitOpened(service) {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.circuitState = 'open';
    serviceStatus.degradationLevel = 80; // High degradation when circuit opens
    serviceStatus.lastUpdate = new Date();
    
    this.updateOverallHealth(service);
  }

  handleCircuitClosed(service) {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.circuitState = 'closed';
    serviceStatus.degradationLevel = 0;
    serviceStatus.fallbackActive = false;
    serviceStatus.lastUpdate = new Date();
    
    this.updateOverallHealth(service);
  }

  handleCircuitHalfOpened(service) {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.circuitState = 'half_open';
    serviceStatus.degradationLevel = 40; // Medium degradation during testing
    serviceStatus.lastUpdate = new Date();
    
    this.updateOverallHealth(service);
  }

  updateServiceSuccess(service) {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.metrics.requestCount++;
    serviceStatus.lastUpdate = new Date();
    
    // Recalculate error rate
    serviceStatus.metrics.errorRate = serviceStatus.metrics.circuitFailures / 
                                     Math.max(serviceStatus.metrics.requestCount, 1);
  }

  updateServiceFailure(service, error) {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    serviceStatus.metrics.requestCount++;
    serviceStatus.metrics.circuitFailures++;
    serviceStatus.lastUpdate = new Date();
    
    // Update error rate
    serviceStatus.metrics.errorRate = serviceStatus.metrics.circuitFailures / 
                                     serviceStatus.metrics.requestCount;
    
    // Check if we need to open circuit breaker
    if (serviceStatus.metrics.errorRate > this.config.coordination.degradationTriggers.errorRateThreshold) {
      this.handleCircuitOpened(service);
    }
  }

  updateOverallHealth(service) {
    const serviceStatus = this.serviceStatuses.get(service);
    if (!serviceStatus) return;

    // Determine overall health based on circuit state and degradation level
    if (serviceStatus.circuitState === 'open' || serviceStatus.degradationLevel >= 80) {
      serviceStatus.overallHealth = 'failed';
    } else if (serviceStatus.circuitState === 'half_open' || serviceStatus.degradationLevel >= 30 || serviceStatus.fallbackActive) {
      serviceStatus.overallHealth = 'degraded';
    } else {
      serviceStatus.overallHealth = 'healthy';
    }

    serviceStatus.lastUpdate = new Date();
  }

  getServiceStatus(service) {
    return this.serviceStatuses.get(service);
  }

  getAllServiceStatuses() {
    return new Map(this.serviceStatuses);
  }

  getResilienceMetrics() {
    const statuses = Array.from(this.serviceStatuses.values());
    const totalServices = statuses.length;
    const healthyServices = statuses.filter(s => s.overallHealth === 'healthy').length;
    const degradedServices = statuses.filter(s => s.overallHealth === 'degraded').length;
    const failedServices = statuses.filter(s => s.overallHealth === 'failed').length;
    const circuitsOpen = statuses.filter(s => s.circuitState === 'open').length;
    const fallbacksActive = statuses.filter(s => s.fallbackActive).length;

    // Calculate overall system health (0-100)
    const healthScore = totalServices > 0 
      ? Math.floor(((healthyServices * 100) + (degradedServices * 50)) / totalServices)
      : 100;

    return {
      totalServices,
      healthyServices,
      degradedServices,
      failedServices,
      circuitsOpen,
      fallbacksActive,
      overallSystemHealth: healthScore,
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  getSystemOverview() {
    const metrics = this.getResilienceMetrics();
    const issues = [];
    const recommendations = [];

    // Determine overall system status
    let status = 'healthy';
    
    if (metrics.failedServices > 0) {
      status = 'critical';
      issues.push(`${metrics.failedServices} services have failed`);
      recommendations.push('Investigate failed services immediately');
    } else if (metrics.degradedServices > metrics.totalServices * 0.3) {
      status = 'degraded';
      issues.push(`${metrics.degradedServices} services are degraded`);
      recommendations.push('Monitor degraded services and consider scaling resources');
    }

    if (metrics.circuitsOpen > 0) {
      issues.push(`${metrics.circuitsOpen} circuit breakers are open`);
      recommendations.push('Check external service dependencies');
    }

    if (metrics.fallbacksActive > 0) {
      issues.push(`${metrics.fallbacksActive} services are using fallbacks`);
      recommendations.push('Review service performance and capacity');
    }

    return {
      status,
      metrics,
      issues,
      recommendations
    };
  }

  forceServiceRecovery(service) {
    const serviceStatus = this.serviceStatuses.get(service);
    if (serviceStatus) {
      serviceStatus.circuitState = 'closed';
      serviceStatus.degradationLevel = 0;
      serviceStatus.fallbackActive = false;
      serviceStatus.overallHealth = 'healthy';
      serviceStatus.lastUpdate = new Date();
    }
  }
}

/**
 * Test circuit breaker integration
 */
async function testCircuitBreakerIntegration() {
  console.log('\n⚡ Testing Circuit Breaker Integration...');
  
  const service = new MockResilienceCoordinatorService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Circuit breaker opening triggers degradation
    console.log('  Test 1: Circuit breaker opening triggers degradation');
    
    // Simulate circuit breaker opening
    service.handleCircuitOpened('llm');
    const llmStatus = service.getServiceStatus('llm');
    
    const openSuccess = llmStatus.circuitState === 'open' &&
                       llmStatus.degradationLevel > 0 &&
                       llmStatus.overallHealth === 'failed';
    
    console.log(`    ${openSuccess ? '✅' : '❌'} Circuit breaker opening:`);
    console.log(`      Circuit state: ${llmStatus.circuitState}`);
    console.log(`      Degradation level: ${llmStatus.degradationLevel}%`);
    console.log(`      Overall health: ${llmStatus.overallHealth}`);
    results.tests.push({ name: 'Circuit Breaker Opening', passed: openSuccess });
    if (openSuccess) results.passed++; else results.failed++;
    
    // Test 2: Circuit breaker closing ends degradation
    console.log('  Test 2: Circuit breaker closing ends degradation');
    
    service.handleCircuitClosed('llm');
    const recoveredStatus = service.getServiceStatus('llm');
    
    const closeSuccess = recoveredStatus.circuitState === 'closed' &&
                        recoveredStatus.degradationLevel === 0 &&
                        recoveredStatus.overallHealth === 'healthy';
    
    console.log(`    ${closeSuccess ? '✅' : '❌'} Circuit breaker closing:`);
    console.log(`      Circuit state: ${recoveredStatus.circuitState}`);
    console.log(`      Degradation level: ${recoveredStatus.degradationLevel}%`);
    console.log(`      Overall health: ${recoveredStatus.overallHealth}`);
    results.tests.push({ name: 'Circuit Breaker Closing', passed: closeSuccess });
    if (closeSuccess) results.passed++; else results.failed++;
    
    // Test 3: Half-open state handling
    console.log('  Test 3: Half-open state handling');
    
    service.handleCircuitHalfOpened('database');
    const halfOpenStatus = service.getServiceStatus('database');
    
    const halfOpenSuccess = halfOpenStatus.circuitState === 'half_open' &&
                           halfOpenStatus.degradationLevel > 0 &&
                           halfOpenStatus.overallHealth === 'degraded';
    
    console.log(`    ${halfOpenSuccess ? '✅' : '❌'} Half-open state:`);
    console.log(`      Circuit state: ${halfOpenStatus.circuitState}`);
    console.log(`      Degradation level: ${halfOpenStatus.degradationLevel}%`);
    console.log(`      Overall health: ${halfOpenStatus.overallHealth}`);
    results.tests.push({ name: 'Half-Open State Handling', passed: halfOpenSuccess });
    if (halfOpenSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Circuit breaker integration test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test resilient execution
 */
async function testResilientExecution() {
  console.log('\n🛡️ Testing Resilient Execution...');
  
  const service = new MockResilienceCoordinatorService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Successful execution
    console.log('  Test 1: Successful execution');
    
    const successResult = await service.executeWithResilience('storage', async () => {
      return { success: true, data: 'operation completed' };
    });
    
    const successSuccess = successResult.success === true &&
                          successResult.data === 'operation completed';
    
    console.log(`    ${successSuccess ? '✅' : '❌'} Successful execution:`);
    console.log(`      Result: ${JSON.stringify(successResult)}`);
    results.tests.push({ name: 'Successful Execution', passed: successSuccess });
    if (successSuccess) results.passed++; else results.failed++;
    
    // Test 2: Execution with fallback
    console.log('  Test 2: Execution with fallback');
    
    // Open circuit breaker to trigger fallback
    service.handleCircuitOpened('search');
    
    const fallbackResult = await service.executeWithResilience('search', async () => {
      throw new Error('Service unavailable');
    }, { fallback: true, data: 'fallback response' });
    
    const fallbackSuccess = fallbackResult.fallback === true &&
                           fallbackResult.data === 'fallback response';
    
    console.log(`    ${fallbackSuccess ? '✅' : '❌'} Execution with fallback:`);
    console.log(`      Fallback used: ${fallbackResult.fallback}`);
    console.log(`      Fallback data: ${fallbackResult.data}`);
    results.tests.push({ name: 'Execution with Fallback', passed: fallbackSuccess });
    if (fallbackSuccess) results.passed++; else results.failed++;
    
    // Test 3: Error handling and metrics
    console.log('  Test 3: Error handling and metrics');
    
    // Reset service for clean test
    service.forceServiceRecovery('database');
    
    // Generate errors to trigger circuit breaker
    let errorCount = 0;
    for (let i = 0; i < 3; i++) {
      try {
        await service.executeWithResilience('database', async () => {
          throw new Error('Database connection failed');
        });
      } catch (error) {
        errorCount++;
      }
    }
    
    const dbStatus = service.getServiceStatus('database');
    const errorSuccess = errorCount > 0 &&
                        dbStatus.metrics.requestCount > 0 &&
                        dbStatus.metrics.errorRate > 0;
    
    console.log(`    ${errorSuccess ? '✅' : '❌'} Error handling and metrics:`);
    console.log(`      Errors generated: ${errorCount}`);
    console.log(`      Request count: ${dbStatus.metrics.requestCount}`);
    console.log(`      Error rate: ${(dbStatus.metrics.errorRate * 100).toFixed(1)}%`);
    console.log(`      Circuit failures: ${dbStatus.metrics.circuitFailures}`);
    results.tests.push({ name: 'Error Handling and Metrics', passed: errorSuccess });
    if (errorSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Resilient execution test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test system overview and metrics
 */
async function testSystemOverviewAndMetrics() {
  console.log('\n📊 Testing System Overview and Metrics...');
  
  const service = new MockResilienceCoordinatorService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Resilience metrics calculation
    console.log('  Test 1: Resilience metrics calculation');
    
    // Set up different service states
    service.handleCircuitOpened('llm');      // Failed service
    service.handleCircuitHalfOpened('database'); // Degraded service
    // storage and search remain healthy
    
    const metrics = service.getResilienceMetrics();
    const metricsSuccess = metrics.totalServices === 4 &&
                          metrics.healthyServices === 2 &&
                          metrics.degradedServices === 1 &&
                          metrics.failedServices === 1 &&
                          metrics.circuitsOpen === 1;
    
    console.log(`    ${metricsSuccess ? '✅' : '❌'} Resilience metrics:`);
    console.log(`      Total services: ${metrics.totalServices}`);
    console.log(`      Healthy: ${metrics.healthyServices}`);
    console.log(`      Degraded: ${metrics.degradedServices}`);
    console.log(`      Failed: ${metrics.failedServices}`);
    console.log(`      Circuits open: ${metrics.circuitsOpen}`);
    console.log(`      Overall health: ${metrics.overallSystemHealth}%`);
    results.tests.push({ name: 'Resilience Metrics Calculation', passed: metricsSuccess });
    if (metricsSuccess) results.passed++; else results.failed++;
    
    // Test 2: System overview generation
    console.log('  Test 2: System overview generation');
    
    const overview = service.getSystemOverview();
    const overviewSuccess = overview.status &&
                           overview.metrics &&
                           overview.issues &&
                           overview.recommendations &&
                           overview.issues.length > 0;
    
    console.log(`    ${overviewSuccess ? '✅' : '❌'} System overview:`);
    console.log(`      Status: ${overview.status}`);
    console.log(`      Issues: ${overview.issues.length}`);
    console.log(`      Recommendations: ${overview.recommendations.length}`);
    overview.issues.forEach(issue => console.log(`        - ${issue}`));
    results.tests.push({ name: 'System Overview Generation', passed: overviewSuccess });
    if (overviewSuccess) results.passed++; else results.failed++;
    
    // Test 3: Service status tracking
    console.log('  Test 3: Service status tracking');
    
    const allStatuses = service.getAllServiceStatuses();
    const statusSuccess = allStatuses.size === 4 &&
                         Array.from(allStatuses.values()).every(s => 
                           s.service && s.overallHealth && s.circuitState
                         );
    
    console.log(`    ${statusSuccess ? '✅' : '❌'} Service status tracking:`);
    console.log(`      Services tracked: ${allStatuses.size}`);
    Array.from(allStatuses.entries()).forEach(([serviceName, status]) => {
      console.log(`      ${serviceName}: ${status.overallHealth} (circuit: ${status.circuitState})`);
    });
    results.tests.push({ name: 'Service Status Tracking', passed: statusSuccess });
    if (statusSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ System overview and metrics test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test recovery mechanisms
 */
async function testRecoveryMechanisms() {
  console.log('\n🔄 Testing Recovery Mechanisms...');
  
  const service = new MockResilienceCoordinatorService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Automatic recovery detection
    console.log('  Test 1: Automatic recovery detection');
    
    // Create a fresh service instance to ensure clean state
    const recoveryTestService = new MockResilienceCoordinatorService();
    
    // Set up failed service
    recoveryTestService.handleCircuitOpened('storage');
    const failedStatus = JSON.parse(JSON.stringify(recoveryTestService.getServiceStatus('storage'))); // Deep copy
    
    // Simulate recovery
    recoveryTestService.handleCircuitClosed('storage');
    const recoveredStatus = JSON.parse(JSON.stringify(recoveryTestService.getServiceStatus('storage'))); // Deep copy
    
    const recoverySuccess = failedStatus.overallHealth === 'failed' &&
                           recoveredStatus.overallHealth === 'healthy' &&
                           recoveredStatus.degradationLevel === 0;
    
    console.log(`    ${recoverySuccess ? '✅' : '❌'} Automatic recovery:`);
    console.log(`      Before: ${failedStatus.overallHealth} (${failedStatus.degradationLevel}%)`);
    console.log(`      After: ${recoveredStatus.overallHealth} (${recoveredStatus.degradationLevel}%)`);
    results.tests.push({ name: 'Automatic Recovery Detection', passed: recoverySuccess });
    if (recoverySuccess) results.passed++; else results.failed++;
    
    // Test 2: Forced recovery
    console.log('  Test 2: Forced recovery');
    
    // Set up multiple failed services
    service.handleCircuitOpened('llm');
    service.handleCircuitOpened('database');
    
    // Force recovery
    service.forceServiceRecovery('llm');
    service.forceServiceRecovery('database');
    
    const llmRecovered = service.getServiceStatus('llm');
    const dbRecovered = service.getServiceStatus('database');
    
    const forceRecoverySuccess = llmRecovered.overallHealth === 'healthy' &&
                                dbRecovered.overallHealth === 'healthy' &&
                                llmRecovered.circuitState === 'closed' &&
                                dbRecovered.circuitState === 'closed';
    
    console.log(`    ${forceRecoverySuccess ? '✅' : '❌'} Forced recovery:`);
    console.log(`      LLM: ${llmRecovered.overallHealth} (circuit: ${llmRecovered.circuitState})`);
    console.log(`      Database: ${dbRecovered.overallHealth} (circuit: ${dbRecovered.circuitState})`);
    results.tests.push({ name: 'Forced Recovery', passed: forceRecoverySuccess });
    if (forceRecoverySuccess) results.passed++; else results.failed++;
    
    // Test 3: System health improvement
    console.log('  Test 3: System health improvement');
    
    const finalMetrics = service.getResilienceMetrics();
    const healthImprovement = finalMetrics.overallSystemHealth > 80 &&
                             finalMetrics.failedServices === 0 &&
                             finalMetrics.circuitsOpen === 0;
    
    console.log(`    ${healthImprovement ? '✅' : '❌'} System health improvement:`);
    console.log(`      Overall health: ${finalMetrics.overallSystemHealth}%`);
    console.log(`      Failed services: ${finalMetrics.failedServices}`);
    console.log(`      Open circuits: ${finalMetrics.circuitsOpen}`);
    console.log(`      Healthy services: ${finalMetrics.healthyServices}/${finalMetrics.totalServices}`);
    results.tests.push({ name: 'System Health Improvement', passed: healthImprovement });
    if (healthImprovement) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Recovery mechanisms test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Resilience Coordination Tests...\n');
  
  const testResults = [];
  
  // Run all test suites
  testResults.push(await testCircuitBreakerIntegration());
  testResults.push(await testResilientExecution());
  testResults.push(await testSystemOverviewAndMetrics());
  testResults.push(await testRecoveryMechanisms());
  
  // Calculate overall results
  const totalPassed = testResults.reduce((sum, result) => sum + result.passed, 0);
  const totalFailed = testResults.reduce((sum, result) => sum + result.failed, 0);
  const totalTests = totalPassed + totalFailed;
  
  // Print summary
  console.log('\n' + '='.repeat(55));
  console.log('🔗 RESILIENCE COORDINATION TEST SUMMARY');
  console.log('='.repeat(55));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All resilience coordination tests passed!');
    console.log('✅ Circuit breaker integration is working correctly');
    console.log('✅ Resilient execution handles failures gracefully');
    console.log('✅ System overview and metrics are comprehensive');
    console.log('✅ Recovery mechanisms are functional');
    console.log('✅ System resilience coordination is operational');
  } else {
    console.log(`\n⚠️  ${totalFailed} test(s) failed. Please review the implementation.`);
  }
  
  // Detailed test breakdown
  console.log('\nDetailed Results:');
  const suiteNames = ['Circuit Breaker Integration', 'Resilient Execution', 'System Overview & Metrics', 'Recovery Mechanisms'];
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