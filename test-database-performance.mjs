/**
 * Database Performance Optimization Test
 * Tests database performance enhancements, connection pooling, and optimization features
 */

import fetch from 'node-fetch';

console.log('🗄️ TESTING DATABASE PERFORMANCE OPTIMIZATION');
console.log('============================================');

const API_BASE = 'http://localhost:3001';
const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  'x-tenant-id': 'admin',
  'Authorization': 'Bearer admin-token' // In production, use proper admin auth
};

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  batchSize: 100,
  testRecords: 1000
};

/**
 * Test database performance metrics
 */
async function testPerformanceMetrics() {
  console.log('\n📊 Testing Database Performance Metrics...');
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/database/performance`, {
      headers: ADMIN_HEADERS
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('  ✅ Performance metrics retrieved successfully');
      console.log(`  📈 Query Metrics:`);
      console.log(`    Total queries: ${data.performance.queryMetrics.totalQueries}`);
      console.log(`    Average execution time: ${data.performance.queryMetrics.averageExecutionTime.toFixed(2)}ms`);
      console.log(`    Cache hit rate: ${data.performance.queryMetrics.cacheHitRate.toFixed(1)}%`);
      console.log(`    Slow queries: ${data.performance.queryMetrics.slowQueryCount}`);
      
      console.log(`  🔗 Connection Pool:`);
      console.log(`    Total connections: ${data.performance.connectionPool.totalConnections}`);
      console.log(`    Active connections: ${data.performance.connectionPool.activeConnections}`);
      console.log(`    Idle connections: ${data.performance.connectionPool.idleConnections}`);
      
      console.log(`  🧠 Query Analysis:`);
      console.log(`    Slow queries found: ${data.queryAnalysis.slowQueries}`);
      console.log(`    Cache efficiency: ${data.queryAnalysis.cacheEfficiency.toFixed(1)}%`);
      console.log(`    Recommendations: ${data.queryAnalysis.recommendations.length}`);
      
      if (data.queryAnalysis.recommendations.length > 0) {
        console.log(`  💡 Top recommendations:`);
        data.queryAnalysis.recommendations.slice(0, 3).forEach((rec, index) => {
          console.log(`    ${index + 1}. ${rec}`);
        });
      }
      
      return {
        success: true,
        metrics: data.performance,
        analysis: data.queryAnalysis
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test connection pool management
 */
async function testConnectionPool() {
  console.log('\n🔗 Testing Connection Pool Management...');
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/database/connections`, {
      headers: ADMIN_HEADERS
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('  ✅ Connection pool information retrieved');
      console.log(`  📊 Pool Statistics:`);
      console.log(`    Total connections: ${data.stats.totalConnections}`);
      console.log(`    Active connections: ${data.stats.activeConnections}`);
      console.log(`    Idle connections: ${data.stats.idleConnections}`);
      console.log(`    Pending acquires: ${data.stats.pendingAcquires}`);
      console.log(`    Acquire success rate: ${data.stats.acquireCount > 0 ? ((data.stats.acquireSuccessCount / data.stats.acquireCount) * 100).toFixed(1) : 0}%`);
      console.log(`    Average acquire time: ${data.stats.averageAcquireTime.toFixed(2)}ms`);
      
      console.log(`  🏥 Health Status: ${data.health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      if (data.health.issues.length > 0) {
        console.log(`  ⚠️ Issues found:`);
        data.health.issues.forEach((issue, index) => {
          console.log(`    ${index + 1}. ${issue}`);
        });
      }
      
      console.log(`  🔍 Active Connections: ${data.connections.length} shown`);
      data.connections.slice(0, 5).forEach((conn, index) => {
        console.log(`    ${index + 1}. ${conn.id} - Queries: ${conn.queryCount}, Errors: ${conn.errorCount}, Age: ${Math.round(conn.ageMs / 1000)}s`);
      });
      
      return {
        success: true,
        stats: data.stats,
        health: data.health,
        connections: data.connections.length
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test database optimization
 */
async function testDatabaseOptimization() {
  console.log('\n⚡ Testing Database Optimization...');
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/database/optimize`, {
      method: 'POST',
      headers: ADMIN_HEADERS
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('  ✅ Database optimization completed');
      console.log(`  📊 Optimization Results:`);
      console.log(`    Indexes created: ${data.optimization.indexes.created}`);
      console.log(`    Indexes skipped: ${data.optimization.indexes.skipped}`);
      console.log(`    Index errors: ${data.optimization.indexes.errors}`);
      console.log(`    Materialized views created: ${data.optimization.materializedViews.created}`);
      console.log(`    Materialized views refreshed: ${data.optimization.materializedViews.refreshed}`);
      console.log(`    View errors: ${data.optimization.materializedViews.errors}`);
      
      if (data.optimization.indexes.created > 0) {
        console.log(`  🔍 Created indexes:`);
        data.optimization.indexes.details.created.slice(0, 5).forEach((index, i) => {
          console.log(`    ${i + 1}. ${index}`);
        });
      }
      
      if (data.optimization.materializedViews.created > 0 || data.optimization.materializedViews.refreshed > 0) {
        console.log(`  📋 Materialized views:`);
        [...data.optimization.materializedViews.details.created, ...data.optimization.materializedViews.details.refreshed]
          .slice(0, 5).forEach((view, i) => {
          console.log(`    ${i + 1}. ${view}`);
        });
      }
      
      return {
        success: true,
        indexesCreated: data.optimization.indexes.created,
        viewsCreated: data.optimization.materializedViews.created,
        viewsRefreshed: data.optimization.materializedViews.refreshed
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test slow query analysis
 */
async function testSlowQueryAnalysis() {
  console.log('\n🐌 Testing Slow Query Analysis...');
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/database/slow-queries`, {
      headers: ADMIN_HEADERS
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('  ✅ Slow query analysis completed');
      console.log(`  📊 Analysis Results:`);
      console.log(`    Total slow queries: ${data.summary.totalSlowQueries}`);
      console.log(`    Average slow query time: ${data.summary.averageSlowQueryTime.toFixed(2)}ms`);
      console.log(`    Cache efficiency: ${data.cacheEfficiency.toFixed(1)}%`);
      console.log(`    Recommendations: ${data.recommendations.length}`);
      
      if (data.slowQueries.length > 0) {
        console.log(`  🔍 Top slow queries:`);
        data.slowQueries.slice(0, 5).forEach((query, index) => {
          console.log(`    ${index + 1}. ${query.queryType}: ${query.executionTime}ms (${query.rowsAffected} rows)`);
        });
      }
      
      if (data.recommendations.length > 0) {
        console.log(`  💡 Optimization recommendations:`);
        data.recommendations.slice(0, 3).forEach((rec, index) => {
          console.log(`    ${index + 1}. ${rec}`);
        });
      }
      
      return {
        success: true,
        slowQueries: data.summary.totalSlowQueries,
        averageTime: data.summary.averageSlowQueryTime,
        cacheEfficiency: data.cacheEfficiency,
        recommendations: data.recommendations.length
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test batch insert performance
 */
async function testBatchInsert() {
  console.log('\n📦 Testing Batch Insert Performance...');
  
  try {
    // Generate test data
    const testRecords = [];
    for (let i = 0; i < TEST_CONFIG.testRecords; i++) {
      testRecords.push({
        id: `test-${i}`,
        name: `Test Record ${i}`,
        value: Math.floor(Math.random() * 1000),
        created_at: new Date().toISOString(),
        metadata: JSON.stringify({ test: true, index: i })
      });
    }
    
    console.log(`  📊 Generated ${testRecords.length} test records`);
    
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE}/api/admin/database/batch-insert`, {
      method: 'POST',
      headers: ADMIN_HEADERS,
      body: JSON.stringify({
        table: 'test_batch_data',
        records: testRecords,
        options: {
          batchSize: TEST_CONFIG.batchSize,
          onConflict: 'ignore'
        }
      })
    });
    
    const executionTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('  ✅ Batch insert completed');
      console.log(`  📊 Insert Results:`);
      console.log(`    Total records: ${data.totalRecords}`);
      console.log(`    Batch size: ${data.batchSize}`);
      console.log(`    Records inserted: ${data.result.inserted}`);
      console.log(`    Records updated: ${data.result.updated}`);
      console.log(`    Errors: ${data.result.errors}`);
      console.log(`    Execution time: ${executionTime}ms`);
      console.log(`    Records per second: ${(data.totalRecords / (executionTime / 1000)).toFixed(0)}`);
      
      return {
        success: true,
        totalRecords: data.totalRecords,
        inserted: data.result.inserted,
        updated: data.result.updated,
        errors: data.result.errors,
        executionTime,
        recordsPerSecond: data.totalRecords / (executionTime / 1000)
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error, executionTime };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test database health check
 */
async function testDatabaseHealth() {
  console.log('\n🏥 Testing Database Health Check...');
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/database/health`, {
      headers: ADMIN_HEADERS
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`  🏥 Overall Health: ${data.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      
      console.log(`  🔗 Connection Pool: ${data.components.connectionPool.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`    Total connections: ${data.components.connectionPool.stats.totalConnections}`);
      console.log(`    Active connections: ${data.components.connectionPool.stats.activeConnections}`);
      console.log(`    Pending acquires: ${data.components.connectionPool.stats.pendingAcquires}`);
      
      console.log(`  ⚡ Query Performance: ${data.components.queryPerformance.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`    Average execution time: ${data.components.queryPerformance.averageExecutionTime.toFixed(2)}ms`);
      console.log(`    Cache hit rate: ${data.components.queryPerformance.cacheHitRate.toFixed(1)}%`);
      console.log(`    Slow queries: ${data.components.queryPerformance.slowQueryCount}`);
      
      if (data.recommendations.length > 0) {
        console.log(`  💡 Health Recommendations:`);
        data.recommendations.slice(0, 5).forEach((rec, index) => {
          console.log(`    ${index + 1}. ${rec}`);
        });
      }
      
      return {
        success: true,
        healthy: data.healthy,
        connectionPoolHealthy: data.components.connectionPool.healthy,
        queryPerformanceHealthy: data.components.queryPerformance.healthy,
        recommendations: data.recommendations.length
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Run all database performance tests
 */
async function runAllTests() {
  const results = {
    performanceMetrics: null,
    connectionPool: null,
    optimization: null,
    slowQueries: null,
    batchInsert: null,
    healthCheck: null
  };
  
  try {
    console.log('🚀 Starting Database Performance Tests...\n');
    
    // Test performance metrics
    try {
      results.performanceMetrics = await testPerformanceMetrics();
      console.log('✅ Performance metrics test completed');
    } catch (error) {
      console.error('❌ Performance metrics test failed:', error.message);
      results.performanceMetrics = { success: false, error: error.message };
    }
    
    // Test connection pool
    try {
      results.connectionPool = await testConnectionPool();
      console.log('✅ Connection pool test completed');
    } catch (error) {
      console.error('❌ Connection pool test failed:', error.message);
      results.connectionPool = { success: false, error: error.message };
    }
    
    // Test database optimization
    try {
      results.optimization = await testDatabaseOptimization();
      console.log('✅ Database optimization test completed');
    } catch (error) {
      console.error('❌ Database optimization test failed:', error.message);
      results.optimization = { success: false, error: error.message };
    }
    
    // Test slow query analysis
    try {
      results.slowQueries = await testSlowQueryAnalysis();
      console.log('✅ Slow query analysis test completed');
    } catch (error) {
      console.error('❌ Slow query analysis test failed:', error.message);
      results.slowQueries = { success: false, error: error.message };
    }
    
    // Test batch insert
    try {
      results.batchInsert = await testBatchInsert();
      console.log('✅ Batch insert test completed');
    } catch (error) {
      console.error('❌ Batch insert test failed:', error.message);
      results.batchInsert = { success: false, error: error.message };
    }
    
    // Test health check
    try {
      results.healthCheck = await testDatabaseHealth();
      console.log('✅ Database health check test completed');
    } catch (error) {
      console.error('❌ Database health check test failed:', error.message);
      results.healthCheck = { success: false, error: error.message };
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  // Print final results
  console.log('\n📋 FINAL DATABASE PERFORMANCE TEST RESULTS');
  console.log('==========================================');
  
  const testResults = [
    { name: 'Performance Metrics', result: results.performanceMetrics },
    { name: 'Connection Pool', result: results.connectionPool },
    { name: 'Database Optimization', result: results.optimization },
    { name: 'Slow Query Analysis', result: results.slowQueries },
    { name: 'Batch Insert Performance', result: results.batchInsert },
    { name: 'Database Health Check', result: results.healthCheck }
  ];
  
  testResults.forEach(({ name, result }) => {
    const status = result?.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${name}`);
    if (!result?.success && result?.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  const passedTests = testResults.filter(t => t.result?.success).length;
  const totalTests = testResults.length;
  
  console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All database performance tests passed!');
    console.log('\n✨ Database performance optimization is working correctly!');
  } else {
    console.log('⚠️ Some tests failed. The database performance system may need attention.');
  }
  
  // Detailed performance summary
  console.log('\n📈 DETAILED PERFORMANCE RESULTS');
  console.log('===============================');
  
  if (results.batchInsert?.success) {
    console.log(`📦 Batch Insert Performance:`);
    console.log(`  Records processed: ${results.batchInsert.totalRecords.toLocaleString()}`);
    console.log(`  Execution time: ${results.batchInsert.executionTime}ms`);
    console.log(`  Throughput: ${Math.round(results.batchInsert.recordsPerSecond).toLocaleString()} records/second`);
  }
  
  if (results.connectionPool?.success) {
    console.log(`🔗 Connection Pool Health:`);
    console.log(`  Pool healthy: ${results.connectionPool.health.healthy ? 'Yes' : 'No'}`);
    console.log(`  Total connections: ${results.connectionPool.stats.totalConnections}`);
    console.log(`  Active connections: ${results.connectionPool.stats.activeConnections}`);
  }
  
  if (results.optimization?.success) {
    console.log(`⚡ Database Optimization:`);
    console.log(`  Indexes created: ${results.optimization.indexesCreated}`);
    console.log(`  Views created: ${results.optimization.viewsCreated}`);
    console.log(`  Views refreshed: ${results.optimization.viewsRefreshed}`);
  }
  
  if (results.healthCheck?.success) {
    console.log(`🏥 Overall Database Health: ${results.healthCheck.healthy ? '✅ Healthy' : '❌ Needs Attention'}`);
  }
  
  return results;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { 
  runAllTests, 
  testPerformanceMetrics, 
  testConnectionPool, 
  testDatabaseOptimization,
  testSlowQueryAnalysis,
  testBatchInsert,
  testDatabaseHealth
};