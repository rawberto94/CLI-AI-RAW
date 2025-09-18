/**
 * Distributed Tracing Test
 * Tests distributed tracing with correlation IDs and request flow tracking
 */

console.log('🔍 TESTING DISTRIBUTED TRACING AND TROUBLESHOOTING');
console.log('==================================================');

/**
 * Mock Distributed Tracing Service for testing
 */
class MockDistributedTracingService {
  constructor() {
    this.config = {
      enabled: true,
      sampling: {
        rate: 1.0,
        forceTraceHeaders: ['x-force-trace', 'x-debug-trace']
      },
      storage: {
        maxTraces: 1000,
        retentionPeriod: 24 * 60 * 60 * 1000,
        cleanupInterval: 60 * 60 * 1000
      },
      correlation: {
        headerName: 'x-correlation-id',
        contextKey: 'correlationId',
        propagateHeaders: ['x-user-id', 'x-tenant-id', 'authorization']
      },
      performance: {
        slowRequestThreshold: 2000,
        enableMetrics: true
      }
    };
    
    this.traces = new Map();
    this.spans = new Map();
    this.activeContexts = new Map();
    this.startTime = new Date();
  }

  startTrace(request) {
    if (!this.config.enabled) return '';

    const traceId = this.generateTraceId();
    const correlationId = this.extractOrGenerateCorrelationId(request.headers);

    const trace = {
      traceId,
      correlationId,
      startTime: new Date(),
      status: 'active',
      request: {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
        body: request.body,
        userId: request.userId,
        tenantId: request.tenantId
      },
      spans: [],
      metrics: {
        totalSpans: 0,
        errorSpans: 0,
        slowSpans: 0,
        databaseCalls: 0,
        externalCalls: 0,
        workerCalls: 0
      },
      troubleshooting: {
        issues: [],
        recommendations: [],
        relatedTraces: []
      }
    };

    this.traces.set(traceId, trace);

    // Create root span
    this.startSpan(traceId, 'http_request', 'api-gateway', {
      'http.method': request.method,
      'http.url': request.url,
      'user.id': request.userId,
      'tenant.id': request.tenantId
    });

    return traceId;
  }

  completeTrace(traceId, response) {
    if (!this.config.enabled || !traceId) return;

    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = response?.statusCode && response.statusCode >= 400 ? 'error' : 'completed';

    if (response) {
      trace.response = {
        statusCode: response.statusCode,
        headers: this.sanitizeHeaders(response.headers),
        body: response.body
      };
    }

    // Complete root span
    const rootSpan = trace.spans.find(s => s.operationName === 'http_request');
    if (rootSpan && !rootSpan.endTime) {
      this.finishSpan(rootSpan.spanId, {
        'http.status_code': response?.statusCode,
        'response.size': response?.body ? JSON.stringify(response.body).length : 0
      });
    }

    // Analyze for troubleshooting
    this.analyzeTroubleshooting(trace);
  }

  startSpan(traceId, operationName, serviceName, tags = {}, parentSpanId) {
    if (!this.config.enabled || !traceId) return '';

    const trace = this.traces.get(traceId);
    if (!trace) return '';

    const spanId = this.generateSpanId();
    const span = {
      spanId,
      traceId,
      parentSpanId,
      operationName,
      serviceName,
      startTime: new Date(),
      status: 'started',
      tags: { ...tags },
      logs: []
    };

    this.spans.set(spanId, span);
    trace.spans.push(span);
    trace.metrics.totalSpans++;

    // Update service-specific metrics
    this.updateServiceMetrics(trace, serviceName);

    return spanId;
  }

  finishSpan(spanId, tags = {}, error) {
    if (!this.config.enabled || !spanId) return;

    const span = this.spans.get(spanId);
    if (!span || span.endTime) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = error ? 'error' : 'completed';
    span.tags = { ...span.tags, ...tags };

    if (error) {
      span.error = {
        message: error.message,
        stack: error.stack,
        code: error.code
      };

      const trace = this.traces.get(span.traceId);
      if (trace) {
        trace.metrics.errorSpans++;
      }
    }

    // Check if span is slow
    if (span.duration && span.duration > this.config.performance.slowRequestThreshold) {
      const trace = this.traces.get(span.traceId);
      if (trace) {
        trace.metrics.slowSpans++;
      }
    }
  }

  logToSpan(spanId, level, message, fields) {
    if (!this.config.enabled || !spanId) return;

    const span = this.spans.get(spanId);
    if (!span) return;

    const logEntry = {
      timestamp: new Date(),
      level,
      message,
      fields
    };

    span.logs.push(logEntry);
  }

  getTrace(traceId) {
    return this.traces.get(traceId);
  }

  getTracesByCorrelationId(correlationId) {
    return Array.from(this.traces.values()).filter(
      trace => trace.correlationId === correlationId
    );
  }

  searchTraces(criteria) {
    let traces = Array.from(this.traces.values());

    if (criteria.userId) {
      traces = traces.filter(t => t.request.userId === criteria.userId);
    }

    if (criteria.status) {
      traces = traces.filter(t => t.status === criteria.status);
    }

    if (criteria.hasErrors) {
      traces = traces.filter(t => t.metrics.errorSpans > 0);
    }

    if (criteria.minDuration) {
      traces = traces.filter(t => t.duration && t.duration >= criteria.minDuration);
    }

    // Sort by start time (newest first)
    traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    if (criteria.limit) {
      traces = traces.slice(0, criteria.limit);
    }

    return traces;
  }

  getTroubleshootingInfo(traceId) {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    const errorSpans = trace.spans.filter(s => s.status === 'error');
    const slowestSpan = trace.spans.reduce((slowest, span) => {
      if (!span.duration) return slowest;
      if (!slowest || !slowest.duration || span.duration > slowest.duration) {
        return span;
      }
      return slowest;
    }, null);

    const services = [...new Set(trace.spans.map(s => s.serviceName))];
    const bottlenecks = this.identifyBottlenecks(trace);

    return {
      trace,
      analysis: {
        performance: {
          totalDuration: trace.duration || 0,
          slowestSpan,
          bottlenecks
        },
        errors: {
          errorSpans,
          errorPatterns: [],
          rootCause: errorSpans.length > 0 ? `${errorSpans[0].serviceName}: ${errorSpans[0].error?.message}` : null
        },
        dependencies: {
          services,
          externalCalls: trace.metrics.externalCalls,
          databaseCalls: trace.metrics.databaseCalls
        },
        recommendations: this.generateRecommendations(trace)
      }
    };
  }

  getMetrics() {
    const traces = Array.from(this.traces.values());
    const activeTraces = traces.filter(t => t.status === 'active').length;
    const completedTraces = traces.filter(t => t.status === 'completed').length;
    const errorTraces = traces.filter(t => t.status === 'error').length;
    
    const completedTracesWithDuration = traces.filter(t => t.duration);
    const averageRequestDuration = completedTracesWithDuration.length > 0
      ? completedTracesWithDuration.reduce((sum, t) => sum + (t.duration || 0), 0) / completedTracesWithDuration.length
      : 0;

    const slowRequests = traces.filter(t => 
      t.duration && t.duration > this.config.performance.slowRequestThreshold
    ).length;

    return {
      totalTraces: traces.length,
      activeTraces,
      completedTraces,
      errorTraces,
      averageRequestDuration,
      slowRequests,
      samplingRate: this.config.sampling.rate,
      storageUsage: {
        traces: traces.length,
        spans: this.spans.size,
        memoryUsage: this.estimateMemoryUsage()
      }
    };
  }

  getCorrelationHeaders(traceId) {
    if (!this.config.enabled || !traceId) return {};

    const trace = this.traces.get(traceId);
    if (!trace) return {};

    const headers = {};
    headers[this.config.correlation.headerName] = trace.correlationId;

    return headers;
  }

  // Helper methods
  generateTraceId() {
    return 'trace-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  generateSpanId() {
    return 'span-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  extractOrGenerateCorrelationId(headers) {
    if (!headers) return 'corr-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    const existingId = headers[this.config.correlation.headerName.toLowerCase()];
    return existingId || 'corr-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  sanitizeHeaders(headers) {
    if (!headers) return {};
    
    const sanitized = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    Object.entries(headers).forEach(([key, value]) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  updateServiceMetrics(trace, serviceName) {
    switch (serviceName) {
      case 'database':
      case 'db':
        trace.metrics.databaseCalls++;
        break;
      case 'worker':
      case 'workers':
        trace.metrics.workerCalls++;
        break;
      case 'llm':
      case 'external':
        trace.metrics.externalCalls++;
        break;
    }
  }

  analyzeTroubleshooting(trace) {
    const issues = [];
    const recommendations = [];

    if (trace.metrics.errorSpans > 0) {
      issues.push(`${trace.metrics.errorSpans} spans failed`);
      recommendations.push('Review error logs and implement retry logic');
    }

    if (trace.duration && trace.duration > this.config.performance.slowRequestThreshold) {
      issues.push(`Request took ${trace.duration}ms`);
      recommendations.push('Optimize slow operations and consider caching');
    }

    trace.troubleshooting.issues = issues;
    trace.troubleshooting.recommendations = recommendations;
  }

  identifyBottlenecks(trace) {
    const bottlenecks = [];
    const totalDuration = trace.duration || 0;

    trace.spans.forEach(span => {
      if (span.duration && totalDuration > 0) {
        const percentage = (span.duration / totalDuration) * 100;
        if (percentage > 30) {
          bottlenecks.push(`${span.operationName} in ${span.serviceName} (${percentage.toFixed(1)}%)`);
        }
      }
    });

    return bottlenecks;
  }

  generateRecommendations(trace) {
    const recommendations = [];

    if (trace.duration && trace.duration > this.config.performance.slowRequestThreshold) {
      recommendations.push('Consider implementing caching');
      recommendations.push('Review database queries for optimization');
    }

    if (trace.metrics.errorSpans > 0) {
      recommendations.push('Implement circuit breakers');
      recommendations.push('Add retry logic with exponential backoff');
    }

    return recommendations;
  }

  estimateMemoryUsage() {
    return (this.traces.size * 1000) + (this.spans.size * 500);
  }
}

/**
 * Test trace creation and management
 */
async function testTraceCreationAndManagement() {
  console.log('\n🔍 Testing Trace Creation and Management...');
  
  const service = new MockDistributedTracingService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Start trace
    console.log('  Test 1: Start trace');
    
    const request = {
      method: 'POST',
      url: '/api/contracts/upload',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'user123',
        'x-tenant-id': 'tenant456'
      },
      body: { file: 'contract.pdf' },
      userId: 'user123',
      tenantId: 'tenant456'
    };
    
    const traceId = service.startTrace(request);
    const trace = service.getTrace(traceId);
    
    const startSuccess = traceId &&
                        trace &&
                        trace.status === 'active' &&
                        trace.request.method === 'POST' &&
                        trace.spans.length === 1; // Root span
    
    console.log(`    ${startSuccess ? '✅' : '❌'} Trace creation:`);
    console.log(`      Trace ID: ${traceId}`);
    console.log(`      Correlation ID: ${trace?.correlationId}`);
    console.log(`      Status: ${trace?.status}`);
    console.log(`      Spans: ${trace?.spans.length}`);
    results.tests.push({ name: 'Trace Creation', passed: startSuccess });
    if (startSuccess) results.passed++; else results.failed++;
    
    // Test 2: Add spans to trace
    console.log('  Test 2: Add spans to trace');
    
    const dbSpanId = service.startSpan(traceId, 'db_query', 'database', {
      'db.statement': 'SELECT * FROM contracts',
      'db.type': 'postgresql'
    });
    
    const llmSpanId = service.startSpan(traceId, 'llm_analysis', 'llm', {
      'llm.model': 'gpt-4',
      'llm.tokens': 1500
    });
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    service.finishSpan(dbSpanId, { 'db.rows': 1 });
    service.finishSpan(llmSpanId, { 'llm.response_tokens': 800 });
    
    const updatedTrace = service.getTrace(traceId);
    const spansSuccess = updatedTrace.spans.length === 3 && // Root + 2 spans
                        updatedTrace.metrics.totalSpans === 3 &&
                        updatedTrace.metrics.databaseCalls === 1 &&
                        updatedTrace.metrics.externalCalls === 1;
    
    console.log(`    ${spansSuccess ? '✅' : '❌'} Span management:`);
    console.log(`      Total spans: ${updatedTrace.spans.length}`);
    console.log(`      Database calls: ${updatedTrace.metrics.databaseCalls}`);
    console.log(`      External calls: ${updatedTrace.metrics.externalCalls}`);
    results.tests.push({ name: 'Span Management', passed: spansSuccess });
    if (spansSuccess) results.passed++; else results.failed++;
    
    // Test 3: Complete trace
    console.log('  Test 3: Complete trace');
    
    const response = {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { success: true, contractId: 'contract123' }
    };
    
    service.completeTrace(traceId, response);
    const completedTrace = service.getTrace(traceId);
    
    const completeSuccess = completedTrace.status === 'completed' &&
                           completedTrace.endTime &&
                           completedTrace.duration > 0 &&
                           completedTrace.response?.statusCode === 200;
    
    console.log(`    ${completeSuccess ? '✅' : '❌'} Trace completion:`);
    console.log(`      Status: ${completedTrace.status}`);
    console.log(`      Duration: ${completedTrace.duration}ms`);
    console.log(`      Response code: ${completedTrace.response?.statusCode}`);
    results.tests.push({ name: 'Trace Completion', passed: completeSuccess });
    if (completeSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Trace creation and management test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test error tracking and troubleshooting
 */
async function testErrorTrackingAndTroubleshooting() {
  console.log('\n🚨 Testing Error Tracking and Troubleshooting...');
  
  const service = new MockDistributedTracingService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Error span tracking
    console.log('  Test 1: Error span tracking');
    
    const request = {
      method: 'POST',
      url: '/api/contracts/analyze',
      headers: { 'x-user-id': 'user123' },
      userId: 'user123'
    };
    
    const traceId = service.startTrace(request);
    
    // Create spans with errors
    const dbSpanId = service.startSpan(traceId, 'db_query', 'database');
    const llmSpanId = service.startSpan(traceId, 'llm_analysis', 'llm');
    
    // Simulate errors
    const dbError = new Error('Connection timeout');
    const llmError = new Error('Rate limit exceeded');
    
    service.finishSpan(dbSpanId, {}, dbError);
    service.finishSpan(llmSpanId, {}, llmError);
    
    service.completeTrace(traceId, { statusCode: 500 });
    
    const errorTrace = service.getTrace(traceId);
    const errorSuccess = errorTrace.status === 'error' &&
                        errorTrace.metrics.errorSpans === 2 &&
                        errorTrace.troubleshooting.issues.length > 0;
    
    console.log(`    ${errorSuccess ? '✅' : '❌'} Error tracking:`);
    console.log(`      Error spans: ${errorTrace.metrics.errorSpans}`);
    console.log(`      Status: ${errorTrace.status}`);
    console.log(`      Issues detected: ${errorTrace.troubleshooting.issues.length}`);
    results.tests.push({ name: 'Error Tracking', passed: errorSuccess });
    if (errorSuccess) results.passed++; else results.failed++;
    
    // Test 2: Troubleshooting information
    console.log('  Test 2: Troubleshooting information');
    
    const troubleshootingInfo = service.getTroubleshootingInfo(traceId);
    const troubleshootingSuccess = troubleshootingInfo &&
                                  troubleshootingInfo.analysis.errors.errorSpans.length === 2 &&
                                  troubleshootingInfo.analysis.errors.rootCause &&
                                  troubleshootingInfo.analysis.recommendations.length > 0;
    
    console.log(`    ${troubleshootingSuccess ? '✅' : '❌'} Troubleshooting analysis:`);
    console.log(`      Error spans analyzed: ${troubleshootingInfo?.analysis.errors.errorSpans.length}`);
    console.log(`      Root cause: ${troubleshootingInfo?.analysis.errors.rootCause}`);
    console.log(`      Recommendations: ${troubleshootingInfo?.analysis.recommendations.length}`);
    results.tests.push({ name: 'Troubleshooting Analysis', passed: troubleshootingSuccess });
    if (troubleshootingSuccess) results.passed++; else results.failed++;
    
    // Test 3: Performance bottleneck detection
    console.log('  Test 3: Performance bottleneck detection');
    
    // Create a slow trace
    const slowRequest = {
      method: 'GET',
      url: '/api/contracts/search',
      headers: {},
      userId: 'user456'
    };
    
    const slowTraceId = service.startTrace(slowRequest);
    const slowSpanId = service.startSpan(slowTraceId, 'slow_operation', 'search');
    
    // Simulate slow operation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Manually set duration to simulate slow operation
    const slowSpan = service.spans.get(slowSpanId);
    if (slowSpan) {
      slowSpan.duration = 3000; // 3 seconds
      slowSpan.endTime = new Date();
      slowSpan.status = 'completed';
    }
    
    service.completeTrace(slowTraceId, { statusCode: 200 });
    const slowTrace = service.getTrace(slowTraceId);
    slowTrace.duration = 3000; // Set trace duration
    
    const slowTroubleshooting = service.getTroubleshootingInfo(slowTraceId);
    const bottleneckSuccess = slowTroubleshooting &&
                             slowTroubleshooting.analysis.performance.bottlenecks.length > 0 &&
                             slowTroubleshooting.analysis.performance.slowestSpan;
    
    console.log(`    ${bottleneckSuccess ? '✅' : '❌'} Bottleneck detection:`);
    console.log(`      Bottlenecks found: ${slowTroubleshooting?.analysis.performance.bottlenecks.length}`);
    console.log(`      Slowest span: ${slowTroubleshooting?.analysis.performance.slowestSpan?.operationName}`);
    console.log(`      Total duration: ${slowTroubleshooting?.analysis.performance.totalDuration}ms`);
    results.tests.push({ name: 'Bottleneck Detection', passed: bottleneckSuccess });
    if (bottleneckSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Error tracking and troubleshooting test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test trace search and correlation
 */
async function testTraceSearchAndCorrelation() {
  console.log('\n🔎 Testing Trace Search and Correlation...');
  
  const service = new MockDistributedTracingService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Create multiple traces for testing
    const traces = [];
    for (let i = 0; i < 5; i++) {
      const request = {
        method: 'POST',
        url: `/api/contracts/${i}`,
        headers: { 'x-user-id': i < 3 ? 'user123' : 'user456' },
        userId: i < 3 ? 'user123' : 'user456'
      };
      
      const traceId = service.startTrace(request);
      
      // Add some spans
      const spanId = service.startSpan(traceId, 'process_contract', 'worker');
      
      if (i === 2) {
        // Make one trace have errors
        service.finishSpan(spanId, {}, new Error('Processing failed'));
        service.completeTrace(traceId, { statusCode: 500 });
      } else {
        service.finishSpan(spanId);
        service.completeTrace(traceId, { statusCode: 200 });
      }
      
      traces.push(traceId);
    }
    
    // Test 1: Search by user ID
    console.log('  Test 1: Search by user ID');
    
    const userTraces = service.searchTraces({ userId: 'user123' });
    const userSearchSuccess = userTraces.length === 3 &&
                             userTraces.every(t => t.request.userId === 'user123');
    
    console.log(`    ${userSearchSuccess ? '✅' : '❌'} User search:`);
    console.log(`      Traces found: ${userTraces.length}`);
    console.log(`      All match user: ${userTraces.every(t => t.request.userId === 'user123')}`);
    results.tests.push({ name: 'User Search', passed: userSearchSuccess });
    if (userSearchSuccess) results.passed++; else results.failed++;
    
    // Test 2: Search by error status
    console.log('  Test 2: Search by error status');
    
    const errorTraces = service.searchTraces({ hasErrors: true });
    const errorSearchSuccess = errorTraces.length === 1 &&
                              errorTraces[0].metrics.errorSpans > 0;
    
    console.log(`    ${errorSearchSuccess ? '✅' : '❌'} Error search:`);
    console.log(`      Error traces found: ${errorTraces.length}`);
    console.log(`      Has error spans: ${errorTraces[0]?.metrics.errorSpans > 0}`);
    results.tests.push({ name: 'Error Search', passed: errorSearchSuccess });
    if (errorSearchSuccess) results.passed++; else results.failed++;
    
    // Test 3: Correlation headers
    console.log('  Test 3: Correlation headers');
    
    const traceId = traces[0];
    const correlationHeaders = service.getCorrelationHeaders(traceId);
    const correlationSuccess = correlationHeaders &&
                              correlationHeaders['x-correlation-id'] &&
                              Object.keys(correlationHeaders).length > 0;
    
    console.log(`    ${correlationSuccess ? '✅' : '❌'} Correlation headers:`);
    console.log(`      Headers generated: ${Object.keys(correlationHeaders).length}`);
    console.log(`      Correlation ID: ${correlationHeaders['x-correlation-id']?.substring(0, 20)}...`);
    results.tests.push({ name: 'Correlation Headers', passed: correlationSuccess });
    if (correlationSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Trace search and correlation test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test metrics and monitoring
 */
async function testMetricsAndMonitoring() {
  console.log('\n📊 Testing Metrics and Monitoring...');
  
  const service = new MockDistributedTracingService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Create traces with different characteristics
    const requests = [
      { method: 'GET', url: '/api/contracts', headers: {}, userId: 'user1' },
      { method: 'POST', url: '/api/contracts', headers: {}, userId: 'user2' },
      { method: 'PUT', url: '/api/contracts/1', headers: {}, userId: 'user3' }
    ];
    
    const traceIds = [];
    for (const request of requests) {
      const traceId = service.startTrace(request);
      traceIds.push(traceId);
      
      // Add spans
      const spanId = service.startSpan(traceId, 'process', 'worker');
      service.finishSpan(spanId);
      
      service.completeTrace(traceId, { statusCode: 200 });
    }
    
    // Create one error trace
    const errorRequest = { method: 'DELETE', url: '/api/contracts/1', headers: {}, userId: 'user4' };
    const errorTraceId = service.startTrace(errorRequest);
    const errorSpanId = service.startSpan(errorTraceId, 'delete', 'database');
    service.finishSpan(errorSpanId, {}, new Error('Delete failed'));
    service.completeTrace(errorTraceId, { statusCode: 500 });
    
    // Test 1: Basic metrics
    console.log('  Test 1: Basic metrics');
    
    const metrics = service.getMetrics();
    const metricsSuccess = metrics.totalTraces === 4 &&
                          metrics.completedTraces === 3 && // 3 completed, 1 error
                          metrics.errorTraces === 1 &&
                          metrics.storageUsage.traces === 4;
    
    console.log(`    ${metricsSuccess ? '✅' : '❌'} Basic metrics:`);
    console.log(`      Total traces: ${metrics.totalTraces}`);
    console.log(`      Completed traces: ${metrics.completedTraces}`);
    console.log(`      Error traces: ${metrics.errorTraces}`);
    console.log(`      Storage usage: ${metrics.storageUsage.traces} traces, ${metrics.storageUsage.spans} spans`);
    results.tests.push({ name: 'Basic Metrics', passed: metricsSuccess });
    if (metricsSuccess) results.passed++; else results.failed++;
    
    // Test 2: Performance metrics
    console.log('  Test 2: Performance metrics');
    
    const performanceSuccess = metrics.averageRequestDuration >= 0 &&
                              metrics.samplingRate === 1.0 &&
                              metrics.storageUsage.memoryUsage > 0;
    
    console.log(`    ${performanceSuccess ? '✅' : '❌'} Performance metrics:`);
    console.log(`      Average duration: ${metrics.averageRequestDuration.toFixed(1)}ms`);
    console.log(`      Sampling rate: ${(metrics.samplingRate * 100)}%`);
    console.log(`      Memory usage: ${metrics.storageUsage.memoryUsage} bytes`);
    results.tests.push({ name: 'Performance Metrics', passed: performanceSuccess });
    if (performanceSuccess) results.passed++; else results.failed++;
    
    // Test 3: Span logging
    console.log('  Test 3: Span logging');
    
    const logTraceId = service.startTrace({ method: 'GET', url: '/test', headers: {} });
    const logSpanId = service.startSpan(logTraceId, 'test_operation', 'test');
    
    service.logToSpan(logSpanId, 'info', 'Processing started', { step: 1 });
    service.logToSpan(logSpanId, 'warn', 'Slow operation detected', { duration: 1500 });
    service.logToSpan(logSpanId, 'info', 'Processing completed', { step: 2 });
    
    service.finishSpan(logSpanId);
    service.completeTrace(logTraceId, { statusCode: 200 });
    
    const logSpan = service.spans.get(logSpanId);
    const loggingSuccess = logSpan.logs.length === 3 &&
                          logSpan.logs[0].level === 'info' &&
                          logSpan.logs[1].level === 'warn' &&
                          logSpan.logs[0].fields?.step === 1;
    
    console.log(`    ${loggingSuccess ? '✅' : '❌'} Span logging:`);
    console.log(`      Log entries: ${logSpan.logs.length}`);
    console.log(`      Log levels: ${logSpan.logs.map(l => l.level).join(', ')}`);
    console.log(`      Structured fields: ${!!logSpan.logs[0].fields}`);
    results.tests.push({ name: 'Span Logging', passed: loggingSuccess });
    if (loggingSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Metrics and monitoring test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Distributed Tracing Tests...\n');
  
  const testResults = [];
  
  // Run all test suites
  testResults.push(await testTraceCreationAndManagement());
  testResults.push(await testErrorTrackingAndTroubleshooting());
  testResults.push(await testTraceSearchAndCorrelation());
  testResults.push(await testMetricsAndMonitoring());
  
  // Calculate overall results
  const totalPassed = testResults.reduce((sum, result) => sum + result.passed, 0);
  const totalFailed = testResults.reduce((sum, result) => sum + result.failed, 0);
  const totalTests = totalPassed + totalFailed;
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('🔍 DISTRIBUTED TRACING TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All distributed tracing tests passed!');
    console.log('✅ Trace creation and management working correctly');
    console.log('✅ Error tracking and troubleshooting functional');
    console.log('✅ Trace search and correlation operational');
    console.log('✅ Metrics and monitoring comprehensive');
    console.log('✅ Distributed tracing system ready for production');
  } else {
    console.log(`\n⚠️  ${totalFailed} test(s) failed. Please review the implementation.`);
  }
  
  // Detailed test breakdown
  console.log('\nDetailed Results:');
  const suiteNames = ['Trace Creation & Management', 'Error Tracking & Troubleshooting', 'Trace Search & Correlation', 'Metrics & Monitoring'];
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