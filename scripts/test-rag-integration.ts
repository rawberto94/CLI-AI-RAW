/**
 * RAG Integration Test Script
 * 
 * Tests the complete integration between artifact generation and RAG system
 */

import { ragIntegrationService } from '../packages/data-orchestration/src/services/rag-integration.service';
import { eventBus, Events } from '../packages/data-orchestration/src/events/event-bus';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function testHealthCheck() {
  logSection('Test 1: Health Check');
  
  try {
    const health = await ragIntegrationService.healthCheck();
    
    log(`Status: ${health.status}`, health.status === 'healthy' ? 'green' : 'yellow');
    log(`Enabled: ${health.details.enabled}`, health.details.enabled ? 'green' : 'red');
    log(`Queue Size: ${health.details.queueSize}`, 'blue');
    
    if (health.status === 'healthy') {
      log('✅ Health check passed', 'green');
      return true;
    } else {
      log('⚠️  System is degraded or unhealthy', 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Health check failed: ${error}`, 'red');
    return false;
  }
}

async function testMetrics() {
  logSection('Test 2: Metrics');
  
  try {
    const metrics = ragIntegrationService.getMetrics();
    
    log(`Total Indexed: ${metrics.totalIndexed}`, 'blue');
    log(`Total Failed: ${metrics.totalFailed}`, 'blue');
    log(`Total Retries: ${metrics.totalRetries}`, 'blue');
    log(`Avg Processing Time: ${Math.round(metrics.avgProcessingTime)}ms`, 'blue');
    log(`Queue Size: ${metrics.queueSize}`, 'blue');
    
    const successRate = metrics.totalIndexed + metrics.totalFailed > 0
      ? (metrics.totalIndexed / (metrics.totalIndexed + metrics.totalFailed)) * 100
      : 0;
    
    log(`Success Rate: ${successRate.toFixed(2)}%`, successRate > 90 ? 'green' : 'yellow');
    
    log('✅ Metrics retrieved successfully', 'green');
    return true;
  } catch (error) {
    log(`❌ Metrics test failed: ${error}`, 'red');
    return false;
  }
}

async function testConfiguration() {
  logSection('Test 3: Configuration');
  
  try {
    const metrics = ragIntegrationService.getMetrics();
    const config = metrics.config;
    
    log(`Enabled: ${config.enabled}`, 'blue');
    log(`Auto-index: ${config.autoIndexOnUpload}`, 'blue');
    log(`Max Retries: ${config.maxRetries}`, 'blue');
    log(`Retry Delay: ${config.retryDelayMs}ms`, 'blue');
    log(`Timeout: ${config.timeoutMs}ms`, 'blue');
    log(`Fail Silently: ${config.failSilently}`, 'blue');
    
    log('✅ Configuration retrieved successfully', 'green');
    return true;
  } catch (error) {
    log(`❌ Configuration test failed: ${error}`, 'red');
    return false;
  }
}

async function testManualIndexing() {
  logSection('Test 4: Manual Indexing');
  
  try {
    log('Creating test artifacts...', 'blue');
    
    const testArtifacts = [
      {
        type: 'title',
        content: 'Test Service Agreement',
        metadata: {},
      },
      {
        type: 'parties',
        content: 'Test Company Inc.',
        metadata: { role: 'client' },
      },
      {
        type: 'clause',
        id: 'clause_1',
        content: 'This is a test clause for payment terms.',
        metadata: { clauseType: 'payment', riskLevel: 'low' },
      },
    ];
    
    log('Triggering manual indexing...', 'blue');
    
    const result = await ragIntegrationService.manualIndex(
      'test-contract-' + Date.now(),
      'test-tenant',
      'test-user',
      testArtifacts
    );
    
    log(`Success: ${result.success}`, result.success ? 'green' : 'red');
    log(`Processing Time: ${result.processingTime}ms`, 'blue');
    log(`Vector Indexed: ${result.vectorIndexed}`, result.vectorIndexed ? 'green' : 'yellow');
    log(`Graph Built: ${result.graphBuilt}`, result.graphBuilt ? 'green' : 'yellow');
    log(`Multi-modal Processed: ${result.multiModalProcessed}`, result.multiModalProcessed ? 'green' : 'yellow');
    
    if (result.error) {
      log(`Error: ${result.error}`, 'red');
    }
    
    if (result.success) {
      log('✅ Manual indexing test passed', 'green');
      return true;
    } else {
      log('⚠️  Manual indexing failed (this may be expected if Chroma DB is not running)', 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Manual indexing test failed: ${error}`, 'red');
    log('Note: This is expected if Chroma DB is not running', 'yellow');
    return false;
  }
}

async function testEventEmission() {
  logSection('Test 5: Event Emission');
  
  try {
    log('Setting up event listener...', 'blue');
    
    let eventReceived = false;
    
    eventBus.on(Events.ARTIFACTS_GENERATED, (data: any) => {
      log('✅ ARTIFACTS_GENERATED event received', 'green');
      log(`Contract ID: ${data.contractId}`, 'blue');
      log(`Tenant ID: ${data.tenantId}`, 'blue');
      eventReceived = true;
    });
    
    log('Emitting test event...', 'blue');
    
    eventBus.emit(Events.ARTIFACTS_GENERATED, {
      contractId: 'test-contract-event',
      tenantId: 'test-tenant',
      userId: 'test-user',
      artifacts: [],
      timestamp: new Date(),
    });
    
    // Wait a bit for event to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (eventReceived) {
      log('✅ Event emission test passed', 'green');
      return true;
    } else {
      log('⚠️  Event not received (Redis may not be running)', 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Event emission test failed: ${error}`, 'red');
    log('Note: This is expected if Redis is not running', 'yellow');
    return false;
  }
}

async function testRetryQueue() {
  logSection('Test 6: Retry Queue');
  
  try {
    const queue = ragIntegrationService.getRetryQueue();
    
    log(`Queue Size: ${queue.length}`, 'blue');
    
    if (queue.length > 0) {
      log('Retry queue items:', 'blue');
      queue.forEach((item, index) => {
        log(`  ${index + 1}. ${item.key}`, 'blue');
        log(`     Retries: ${item.retries}`, 'blue');
        log(`     Last Attempt: ${new Date(item.lastAttempt).toLocaleString()}`, 'blue');
        log(`     Next Retry In: ${Math.round(item.nextRetryIn / 1000)}s`, 'blue');
      });
    } else {
      log('Retry queue is empty', 'green');
    }
    
    log('✅ Retry queue test passed', 'green');
    return true;
  } catch (error) {
    log(`❌ Retry queue test failed: ${error}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log('\n🧪 RAG Integration Test Suite', 'cyan');
  log('Testing the integration between artifact generation and RAG system\n', 'cyan');
  
  const results = {
    healthCheck: false,
    metrics: false,
    configuration: false,
    manualIndexing: false,
    eventEmission: false,
    retryQueue: false,
  };
  
  results.healthCheck = await testHealthCheck();
  results.metrics = await testMetrics();
  results.configuration = await testConfiguration();
  results.manualIndexing = await testManualIndexing();
  results.eventEmission = await testEventEmission();
  results.retryQueue = await testRetryQueue();
  
  // Summary
  logSection('Test Summary');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const icon = result ? '✅' : '❌';
    const color = result ? 'green' : 'red';
    log(`${icon} ${test}`, color);
  });
  
  console.log('\n' + '='.repeat(60));
  log(`\nResults: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n🎉 All tests passed! RAG integration is working correctly.', 'green');
  } else {
    log('\n⚠️  Some tests failed. This may be expected if:', 'yellow');
    log('  - Chroma DB is not running (affects manual indexing)', 'yellow');
    log('  - Redis is not running (affects event emission)', 'yellow');
    log('  - RAG integration is disabled in config', 'yellow');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  log(`\n❌ Test suite failed: ${error}`, 'red');
  console.error(error);
  process.exit(1);
});
