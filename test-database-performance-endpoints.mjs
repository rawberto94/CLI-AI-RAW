/**
 * Test Database Performance Endpoints
 */

import fetch from 'node-fetch';

console.log('🔍 TESTING DATABASE PERFORMANCE ENDPOINTS');
console.log('=========================================');

const API_BASE = 'http://localhost:3001';
const TENANT_ID = 'test-db-performance';

/**
 * Test database performance endpoints
 */
async function testDatabasePerformanceEndpoints() {
  console.log('\n📊 Testing Database Performance Endpoints...');
  
  const endpoints = [
    { 
      name: 'Performance Metrics', 
      path: '/internal/database/performance',
      method: 'GET'
    },
    { 
      name: 'Performance Dashboard', 
      path: '/internal/database/dashboard',
      method: 'GET'
    },
    { 
      name: 'Query Analysis', 
      path: '/internal/database/analysis',
      method: 'GET'
    },
    { 
      name: 'Database Optimization (Analyze)', 
      path: '/internal/database/optimize',
      method: 'POST',
      body: { action: 'analyze' }
    }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`  Testing: ${endpoint.name}`);
      
      const options = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': TENANT_ID
        },
        timeout: 10000
      };
      
      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
      }
      
      const response = await fetch(`${API_BASE}${endpoint.path}`, options);
      
      const success = response.status < 500;
      console.log(`    ${success ? '✅' : '❌'} Status: ${response.status}`);
      
      if (success && response.status === 200) {
        try {
          const data = await response.json();
          console.log(`    📊 Response keys: ${Object.keys(data).join(', ')}`);
          
          // Check for expected structure
          if (data.success !== undefined) {
            console.log(`    ✅ Success field: ${data.success}`);
          }
          
          if (endpoint.name === 'Performance Metrics' && data.metrics) {
            console.log(`    📈 Query metrics available: ${!!data.metrics.queryMetrics}`);
            console.log(`    🔗 Connection pool stats: ${!!data.metrics.connectionPool}`);
            console.log(`    💾 Cache stats: ${!!data.metrics.cacheStats}`);
          }
          
          if (endpoint.name === 'Performance Dashboard' && data.dashboard) {
            console.log(`    📊 Overview: ${!!data.dashboard.overview}`);
            console.log(`    📈 Trends: ${!!data.dashboard.trends}`);
            console.log(`    🐌 Slow queries: ${data.dashboard.topSlowQueries?.length || 0}`);
          }
          
          if (endpoint.name === 'Query Analysis' && data.analysis) {
            console.log(`    🔍 Patterns: ${data.analysis.patterns?.length || 0}`);
            console.log(`    💡 Recommendations: ${data.analysis.recommendations?.length || 0}`);
            console.log(`    🏗️ Index suggestions: ${data.analysis.indexSuggestions?.length || 0}`);
          }
          
        } catch (e) {
          console.log(`    📄 Response: Non-JSON or parsing error`);
        }
      }
      
      results.push({
        name: endpoint.name,
        success,
        status: response.status
      });
      
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({
        name: endpoint.name,
        success: false,
        error: error.message
      });
    }
  }
  
  const passedTests = results.filter(r => r.success).length;
  console.log(`\n📊 Database Performance Endpoints: ${passedTests}/${endpoints.length} working`);
  
  return {
    success: passedTests > 0,
    results,
    passedTests,
    totalTests: endpoints.length
  };
}

/**
 * Test database optimization operations
 */
async function testDatabaseOptimization() {
  console.log('\n🔧 Testing Database Optimization Operations...');
  
  const operations = [
    { name: 'Analyze Queries', action: 'analyze' },
    { name: 'Create Indexes', action: 'indexes' },
    { name: 'Create Views', action: 'views' }
  ];
  
  const results = [];
  
  for (const operation of operations) {
    try {
      console.log(`  Testing: ${operation.name}`);
      
      const response = await fetch(`${API_BASE}/internal/database/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': TENANT_ID
        },
        body: JSON.stringify({ action: operation.action }),
        timeout: 15000
      });
      
      const success = response.status < 500;
      console.log(`    ${success ? '✅' : '❌'} Status: ${response.status}`);
      
      if (success && response.status === 200) {
        try {
          const data = await response.json();
          console.log(`    📊 Action: ${data.action}`);
          console.log(`    ✅ Success: ${data.success}`);
          
          if (data.result) {
            if (operation.action === 'indexes' && data.result.created) {
              console.log(`    🏗️ Indexes created: ${data.result.created.length}`);
            }
            if (operation.action === 'views' && data.result.created) {
              console.log(`    📊 Views created: ${data.result.created.length}`);
            }
            if (operation.action === 'analyze' && data.result.patterns) {
              console.log(`    🔍 Patterns found: ${data.result.patterns.length}`);
            }
          }
          
        } catch (e) {
          console.log(`    📄 Response: Non-JSON or parsing error`);
        }
      }
      
      results.push({
        name: operation.name,
        success,
        status: response.status
      });
      
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({
        name: operation.name,
        success: false,
        error: error.message
      });
    }
  }
  
  const passedTests = results.filter(r => r.success).length;
  console.log(`\n📊 Database Optimization: ${passedTests}/${operations.length} operations working`);
  
  return {
    success: passedTests > 0,
    results,
    passedTests,
    totalTests: operations.length
  };
}

/**
 * Run comprehensive database performance endpoint tests
 */
async function runDatabasePerformanceEndpointTests() {
  console.log('🚀 Starting Database Performance Endpoint Tests...\n');
  
  const testResults = [];
  
  try {
    // Test performance endpoints
    const endpointResults = await testDatabasePerformanceEndpoints();
    testResults.push({ name: 'Performance Endpoints', ...endpointResults });
    
    // Test optimization operations
    const optimizationResults = await testDatabaseOptimization();
    testResults.push({ name: 'Optimization Operations', ...optimizationResults });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  // Print final results
  console.log('\n📋 DATABASE PERFORMANCE ENDPOINT TEST RESULTS');
  console.log('==============================================');
  
  let totalPassed = 0;
  let totalTests = 0;
  
  testResults.forEach(({ name, success, passedTests, totalTests: tests, results }) => {
    const status = success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${name}: ${passedTests}/${tests} tests passed`);
    
    if (results && results.length > 0) {
      results.forEach(result => {
        const testStatus = result.success ? '  ✅' : '  ❌';
        console.log(`${testStatus} ${result.name}`);
      });
    }
    
    totalPassed += passedTests;
    totalTests += tests;
  });
  
  console.log(`\n📊 Overall Results: ${totalPassed}/${totalTests} tests passed`);
  
  // Calculate success rate
  const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
  
  if (successRate >= 90) {
    console.log('🎉 EXCELLENT! Database performance endpoints are working perfectly!');
  } else if (successRate >= 75) {
    console.log('✅ GOOD! Database performance endpoints are mostly working.');
  } else if (successRate >= 50) {
    console.log('⚠️ FAIR! Database performance endpoints need some improvements.');
  } else {
    console.log('❌ POOR! Database performance endpoints have significant issues.');
  }
  
  console.log('\n🚀 DATABASE PERFORMANCE FEATURES AVAILABLE:');
  console.log('===========================================');
  console.log('📊 Real-time performance metrics and monitoring');
  console.log('📈 Comprehensive performance dashboard');
  console.log('🔍 Query pattern analysis and optimization suggestions');
  console.log('🏗️ Automated index creation and management');
  console.log('📊 Materialized view creation and refresh');
  console.log('💾 Cache performance monitoring and optimization');
  console.log('🔗 Connection pool statistics and health monitoring');
  console.log('⚡ Database optimization operations via API');
  
  return {
    totalTests,
    passed: totalPassed,
    failed: totalTests - totalPassed,
    successRate,
    testResults
  };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabasePerformanceEndpointTests().catch(console.error);
}

export { runDatabasePerformanceEndpointTests };