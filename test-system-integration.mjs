/**
 * System Integration Test
 * Tests core functionality without external dependencies
 */

console.log('🔧 TESTING SYSTEM INTEGRATION');
console.log('=============================');

/**
 * Test service imports and basic functionality
 */
async function testServiceImports() {
  console.log('\n📦 Testing Service Imports...');
  
  const results = [];
  
  // Test progress tracking service
  try {
    const { progressTrackingService, ProcessingStage } = await import('./apps/api/src/services/progress-tracking.service.ts');
    console.log('  ✅ Progress Tracking Service imported successfully');
    
    // Test basic functionality
    const testProgress = progressTrackingService.initializeProgress('test-contract', 'test-tenant');
    console.log(`  📊 Progress initialized: ${testProgress.stage} (${testProgress.progress}%)`);
    
    results.push({ service: 'progress-tracking', success: true });
  } catch (error) {
    console.log(`  ❌ Progress Tracking Service failed: ${error.message}`);
    results.push({ service: 'progress-tracking', success: false, error: error.message });
  }
  
  // Test cross-contract intelligence service
  try {
    const { crossContractIntelligenceService } = await import('./apps/api/src/services/cross-contract-intelligence.service.ts');
    console.log('  ✅ Cross-Contract Intelligence Service imported successfully');
    
    // Test basic functionality
    const mockContracts = [
      { id: 'contract1', name: 'Test Contract 1', vendor: 'TestCorp', totalValue: 100000 },
      { id: 'contract2', name: 'Test Contract 2', vendor: 'TestCorp', totalValue: 150000 }
    ];
    
    const relationships = await crossContractIntelligenceService.analyzeContractRelationships(
      'contract1', 
      'test-tenant', 
      mockContracts
    );
    console.log(`  🔗 Relationships analyzed: ${relationships.length} found`);
    
    results.push({ service: 'cross-contract-intelligence', success: true });
  } catch (error) {
    console.log(`  ❌ Cross-Contract Intelligence Service failed: ${error.message}`);
    results.push({ service: 'cross-contract-intelligence', success: false, error: error.message });
  }
  
  // Test circuit breaker service
  try {
    const { circuitBreakerManager } = await import('./apps/api/src/services/circuit-breaker.service.ts');
    console.log('  ✅ Circuit Breaker Service imported successfully');
    
    // Test basic functionality
    const breaker = circuitBreakerManager.getBreaker('test-service');
    const stats = breaker.getStats();
    console.log(`  ⚡ Circuit breaker created: ${stats.state} state`);
    
    results.push({ service: 'circuit-breaker', success: true });
  } catch (error) {
    console.log(`  ❌ Circuit Breaker Service failed: ${error.message}`);
    results.push({ service: 'circuit-breaker', success: false, error: error.message });
  }
  
  // Test upload error handler service
  try {
    const { uploadErrorHandlerService } = await import('./apps/api/src/services/upload-error-handler.service.ts');
    console.log('  ✅ Upload Error Handler Service imported successfully');
    
    // Test basic functionality
    const testError = new Error('Test error');
    const recovery = await uploadErrorHandlerService.handleError(
      testError, 
      { contractId: 'test-contract', operation: 'test' }
    );
    console.log(`  🛡️ Error handled: ${recovery.action} action recommended`);
    
    results.push({ service: 'upload-error-handler', success: true });
  } catch (error) {
    console.log(`  ❌ Upload Error Handler Service failed: ${error.message}`);
    results.push({ service: 'upload-error-handler', success: false, error: error.message });
  }
  
  return results;
}

/**
 * Test worker shared utilities
 */
async function testWorkerUtilities() {
  console.log('\n🔧 Testing Worker Shared Utilities...');
  
  const results = [];
  
  // Test LLM utils
  try {
    const { getSharedLLMClient, EXPERT_PERSONAS } = await import('./apps/workers/shared/llm-utils.ts');
    console.log('  ✅ LLM Utils imported successfully');
    console.log(`  🧠 Expert personas available: ${Object.keys(EXPERT_PERSONAS).length}`);
    
    const llmClient = getSharedLLMClient();
    console.log(`  🤖 LLM client available: ${llmClient ? 'Yes' : 'No'}`);
    
    results.push({ utility: 'llm-utils', success: true });
  } catch (error) {
    console.log(`  ❌ LLM Utils failed: ${error.message}`);
    results.push({ utility: 'llm-utils', success: false, error: error.message });
  }
  
  // Test RAG utils
  try {
    const { ContentProcessor } = await import('./apps/workers/shared/rag-utils.ts');
    console.log('  ✅ RAG Utils imported successfully');
    
    const processor = new ContentProcessor();
    console.log(`  🔍 Content processor created: ${processor ? 'Yes' : 'No'}`);
    
    results.push({ utility: 'rag-utils', success: true });
  } catch (error) {
    console.log(`  ❌ RAG Utils failed: ${error.message}`);
    results.push({ utility: 'rag-utils', success: false, error: error.message });
  }
  
  // Test best practices utils
  try {
    const { BestPracticesGenerator } = await import('./apps/workers/shared/best-practices-utils.ts');
    console.log('  ✅ Best Practices Utils imported successfully');
    
    const practices = BestPracticesGenerator.generateFinancialBestPractices({
      totalValue: 100000,
      paymentTerms: 'Net 30',
      currency: 'USD'
    });
    console.log(`  💡 Best practices generated: ${practices.practices.length} recommendations`);
    
    results.push({ utility: 'best-practices-utils', success: true });
  } catch (error) {
    console.log(`  ❌ Best Practices Utils failed: ${error.message}`);
    results.push({ utility: 'best-practices-utils', success: false, error: error.message });
  }
  
  // Test database utils
  try {
    const { getSharedDatabaseClient } = await import('./apps/workers/shared/database-utils.ts');
    console.log('  ✅ Database Utils imported successfully');
    
    const dbClient = getSharedDatabaseClient();
    console.log(`  🗄️ Database client available: ${dbClient ? 'Yes' : 'No'}`);
    
    results.push({ utility: 'database-utils', success: true });
  } catch (error) {
    console.log(`  ❌ Database Utils failed: ${error.message}`);
    results.push({ utility: 'database-utils', success: false, error: error.message });
  }
  
  return results;
}

/**
 * Test enhanced workers
 */
async function testEnhancedWorkers() {
  console.log('\n⚙️ Testing Enhanced Workers...');
  
  const results = [];
  const workers = [
    'ingestion.worker.ts',
    'template.worker.ts', 
    'financial.worker.ts',
    'enhanced-overview.worker.ts',
    'clauses.worker.ts',
    'compliance.worker.ts',
    'risk.worker.ts',
    'benchmark.worker.ts'
  ];
  
  for (const workerFile of workers) {
    try {
      const worker = await import(`./apps/workers/${workerFile}`);
      console.log(`  ✅ ${workerFile} imported successfully`);
      
      // Check if worker has the expected run function
      const runFunctionName = `run${workerFile.split('.')[0].charAt(0).toUpperCase() + workerFile.split('.')[0].slice(1).replace('-', '')}`;
      const hasRunFunction = typeof worker[runFunctionName] === 'function' || 
                           typeof worker.runIngestion === 'function' ||
                           typeof worker.runTemplate === 'function' ||
                           typeof worker.runFinancial === 'function' ||
                           typeof worker.runOverview === 'function' ||
                           typeof worker.runClauses === 'function' ||
                           typeof worker.runCompliance === 'function' ||
                           typeof worker.runRisk === 'function' ||
                           typeof worker.runBenchmark === 'function';
      
      console.log(`    🔧 Run function available: ${hasRunFunction ? 'Yes' : 'No'}`);
      
      results.push({ worker: workerFile, success: true, hasRunFunction });
    } catch (error) {
      console.log(`  ❌ ${workerFile} failed: ${error.message}`);
      results.push({ worker: workerFile, success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Test React components
 */
async function testReactComponents() {
  console.log('\n⚛️ Testing React Components...');
  
  const results = [];
  
  // Test progress tracker component
  try {
    const { RealTimeProgressTracker } = await import('./apps/web/components/RealTimeProgressTracker.tsx');
    console.log('  ✅ RealTimeProgressTracker component imported successfully');
    results.push({ component: 'RealTimeProgressTracker', success: true });
  } catch (error) {
    console.log(`  ❌ RealTimeProgressTracker failed: ${error.message}`);
    results.push({ component: 'RealTimeProgressTracker', success: false, error: error.message });
  }
  
  // Test progress client
  try {
    const { createProgressClient } = await import('./apps/web/lib/progress-client.ts');
    console.log('  ✅ Progress Client imported successfully');
    
    const client = createProgressClient({
      apiUrl: 'http://localhost:3001',
      tenantId: 'test-tenant'
    });
    console.log(`  📡 Progress client created: ${client ? 'Yes' : 'No'}`);
    
    results.push({ component: 'progress-client', success: true });
  } catch (error) {
    console.log(`  ❌ Progress Client failed: ${error.message}`);
    results.push({ component: 'progress-client', success: false, error: error.message });
  }
  
  return results;
}

/**
 * Run all integration tests
 */
async function runAllTests() {
  console.log('🚀 Starting System Integration Tests...\n');
  
  const results = {
    services: [],
    utilities: [],
    workers: [],
    components: []
  };
  
  try {
    // Test services
    results.services = await testServiceImports();
    console.log('✅ Service import tests completed');
    
    // Test worker utilities
    results.utilities = await testWorkerUtilities();
    console.log('✅ Worker utility tests completed');
    
    // Test enhanced workers
    results.workers = await testEnhancedWorkers();
    console.log('✅ Enhanced worker tests completed');
    
    // Test React components
    results.components = await testReactComponents();
    console.log('✅ React component tests completed');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  // Print final results
  console.log('\n📋 FINAL INTEGRATION TEST RESULTS');
  console.log('=================================');
  
  const allResults = [
    ...results.services.map(r => ({ ...r, category: 'Service' })),
    ...results.utilities.map(r => ({ ...r, category: 'Utility' })),
    ...results.workers.map(r => ({ ...r, category: 'Worker' })),
    ...results.components.map(r => ({ ...r, category: 'Component' }))
  ];
  
  allResults.forEach(result => {
    const name = result.service || result.utility || result.worker || result.component;
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.category}: ${name}`);
    if (!result.success && result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  const passedTests = allResults.filter(r => r.success).length;
  const totalTests = allResults.length;
  
  console.log(`\n📊 Integration Test Summary: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All integration tests passed!');
    console.log('\n✨ System integration is working correctly!');
  } else {
    console.log('⚠️ Some integration tests failed. Check the errors above.');
  }
  
  // Detailed breakdown
  console.log('\n📈 DETAILED BREAKDOWN');
  console.log('====================');
  
  const servicesPassed = results.services.filter(r => r.success).length;
  const utilitiesPassed = results.utilities.filter(r => r.success).length;
  const workersPassed = results.workers.filter(r => r.success).length;
  const componentsPassed = results.components.filter(r => r.success).length;
  
  console.log(`🔧 Services: ${servicesPassed}/${results.services.length} passed`);
  console.log(`🛠️ Utilities: ${utilitiesPassed}/${results.utilities.length} passed`);
  console.log(`⚙️ Workers: ${workersPassed}/${results.workers.length} passed`);
  console.log(`⚛️ Components: ${componentsPassed}/${results.components.length} passed`);
  
  return results;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests };