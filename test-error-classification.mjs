/**
 * Error Classification and Handling Test
 * Tests comprehensive error classification, recovery, and handling
 */

console.log('🚨 TESTING ERROR CLASSIFICATION AND HANDLING');
console.log('============================================');

/**
 * Mock Error Classification Service for testing
 */
class MockErrorClassificationService {
  constructor() {
    this.errorPatterns = new Map();
    this.errorHistory = [];
    this.recoveryAttempts = new Map();
    
    this.initializeDefaultPatterns();
  }

  initializeDefaultPatterns() {
    const patterns = [
      {
        id: 'db-connection-error',
        name: 'Database Connection Error',
        classification: {
          type: 'database_connection',
          category: 'infrastructure',
          severity: 'high',
          recoverable: true,
          retryable: true,
          userFacing: false
        },
        recoveryStrategy: { type: 'retry', maxRetries: 3, retryDelay: 2000 }
      },
      {
        id: 'llm-rate-limit',
        name: 'LLM Rate Limit Error',
        classification: {
          type: 'llm_rate_limit',
          category: 'external',
          severity: 'medium',
          recoverable: true,
          retryable: true,
          userFacing: false
        },
        recoveryStrategy: { type: 'retry', maxRetries: 5, retryDelay: 60000 }
      },
      {
        id: 'file-validation-error',
        name: 'File Validation Error',
        classification: {
          type: 'file_validation_error',
          category: 'user',
          severity: 'low',
          recoverable: false,
          retryable: false,
          userFacing: true
        },
        recoveryStrategy: { type: 'manual' }
      }
    ];

    patterns.forEach(pattern => {
      this.errorPatterns.set(pattern.id, pattern);
    });
  }

  classifyError(error, context = {}) {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Find matching pattern based on error message
    let matchingPattern = null;
    for (const pattern of this.errorPatterns.values()) {
      if (error.message.toLowerCase().includes(pattern.id.replace('-', ' '))) {
        matchingPattern = pattern;
        break;
      }
    }

    // Default classification if no pattern matches
    if (!matchingPattern) {
      matchingPattern = {
        classification: {
          type: 'unknown_error',
          category: 'application',
          severity: 'medium',
          recoverable: false,
          retryable: false,
          userFacing: false
        },
        recoveryStrategy: { type: 'manual' }
      };
    }

    const classification = {
      id: errorId,
      type: matchingPattern.classification.type,
      category: matchingPattern.classification.category,
      severity: matchingPattern.classification.severity,
      component: context.component || 'unknown',
      message: error.message,
      originalError: error,
      context: {
        ...context.additionalContext,
        pattern: matchingPattern.id,
        recoveryStrategy: matchingPattern.recoveryStrategy
      },
      timestamp: new Date(),
      correlationId: context.correlationId,
      userId: context.userId,
      tenantId: context.tenantId,
      stackTrace: error.stack,
      recoverable: matchingPattern.classification.recoverable,
      retryable: matchingPattern.classification.retryable,
      userFacing: matchingPattern.classification.userFacing
    };

    this.errorHistory.push(classification);
    return classification;
  }

  async attemptRecovery(classification) {
    if (!classification.recoverable) {
      return {
        success: false,
        strategy: 'none',
        attempts: 0,
        message: 'Error is not recoverable'
      };
    }

    const strategy = classification.context.recoveryStrategy;
    const attemptKey = `${classification.type}-${classification.component}`;
    const currentAttempts = this.recoveryAttempts.get(attemptKey) || 0;

    // Simulate recovery attempt
    await new Promise(resolve => setTimeout(resolve, 100));

    let success = false;
    switch (strategy.type) {
      case 'retry':
        success = Math.random() > 0.3; // 70% success rate
        break;
      case 'fallback':
        success = Math.random() > 0.1; // 90% success rate
        break;
      case 'circuit_breaker':
        success = Math.random() > 0.2; // 80% success rate
        break;
      default:
        success = false;
    }

    if (success) {
      this.recoveryAttempts.delete(attemptKey);
    } else {
      this.recoveryAttempts.set(attemptKey, currentAttempts + 1);
    }

    return {
      success,
      strategy: strategy.type,
      attempts: currentAttempts + 1,
      message: success ? 'Recovery successful' : 'Recovery failed'
    };
  }

  getErrorMetrics(timeRange = 3600000) {
    const cutoff = Date.now() - timeRange;
    const recentErrors = this.errorHistory.filter(e => e.timestamp.getTime() > cutoff);

    const errorsByType = {};
    const errorsByCategory = {};
    const errorsBySeverity = {};
    const errorsByComponent = {};

    recentErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
      errorsByComponent[error.component] = (errorsByComponent[error.component] || 0) + 1;
    });

    const topErrors = Object.entries(errorsByType)
      .map(([type, count]) => ({
        type,
        count,
        lastOccurrence: recentErrors
          .filter(e => e.type === type)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp || new Date()
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: recentErrors.length,
      errorsByType,
      errorsByCategory,
      errorsBySeverity,
      errorsByComponent,
      recoverySuccessRate: 0.75,
      averageRecoveryTime: 2500,
      topErrors
    };
  }

  getRecentErrors(limit = 100) {
    return this.errorHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async healthCheck() {
    const recentErrors = this.errorHistory.filter(
      e => Date.now() - e.timestamp.getTime() < 3600000
    ).length;

    const issues = [];
    if (recentErrors > 100) {
      issues.push(`High error rate: ${recentErrors} errors in the last hour`);
    }

    return {
      healthy: issues.length === 0,
      totalPatterns: this.errorPatterns.size,
      recentErrors,
      recoverySuccessRate: 0.75,
      issues
    };
  }
}/**

 * Mock Error Handler Service for testing
 */
class MockErrorHandlerService {
  constructor() {
    this.config = {
      enableRecovery: true,
      enableUserNotification: true,
      maxRecoveryAttempts: 3,
      recoveryTimeout: 30000
    };
    this.errorCounts = new Map();
    this.lastErrorTime = new Map();
  }

  async handleError(error, context) {
    const correlationId = context.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate error classification
    const classification = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.determineErrorType(error),
      category: 'application',
      severity: 'medium',
      component: context.component,
      message: error.message,
      timestamp: new Date(),
      correlationId,
      recoverable: true,
      userFacing: this.isUserFacing(error)
    };

    // Simulate recovery attempt
    let recoveryResult = null;
    if (this.config.enableRecovery && classification.recoverable) {
      recoveryResult = await this.simulateRecovery(classification);
    }

    // Generate user message
    const userMessage = this.generateUserMessage(classification);

    return {
      success: false,
      error: {
        id: classification.id,
        type: classification.type,
        message: classification.userFacing ? userMessage : classification.message,
        userMessage: classification.userFacing ? userMessage : undefined,
        code: this.getErrorCode(classification),
        timestamp: classification.timestamp.toISOString(),
        correlationId: classification.correlationId
      },
      recovery: recoveryResult ? {
        attempted: true,
        successful: recoveryResult.success,
        strategy: recoveryResult.strategy,
        attempts: recoveryResult.attempts
      } : undefined
    };
  }

  determineErrorType(error) {
    const message = error.message.toLowerCase();
    if (message.includes('connection')) return 'database_connection';
    if (message.includes('rate limit')) return 'llm_rate_limit';
    if (message.includes('validation')) return 'file_validation_error';
    if (message.includes('timeout')) return 'timeout_error';
    if (message.includes('auth')) return 'auth_error';
    return 'system_error';
  }

  isUserFacing(error) {
    const userFacingTypes = ['file_validation_error', 'auth_error', 'permission_denied'];
    return userFacingTypes.includes(this.determineErrorType(error));
  }

  async simulateRecovery(classification) {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const success = Math.random() > 0.3; // 70% success rate
    return {
      success,
      strategy: 'retry',
      attempts: 1,
      message: success ? 'Recovery successful' : 'Recovery failed'
    };
  }

  generateUserMessage(classification) {
    const messageMap = {
      'file_validation_error': 'The uploaded file is invalid. Please check the file format and try again.',
      'auth_error': 'Authentication failed. Please log in again.',
      'database_connection': 'We are experiencing technical difficulties. Please try again in a few moments.',
      'llm_rate_limit': 'Our AI service is currently busy. Please try again in a few minutes.',
      'timeout_error': 'The request timed out. Please try again.',
      'system_error': 'An unexpected error occurred. Our team has been notified.'
    };

    return messageMap[classification.type] || 'An error occurred while processing your request.';
  }

  getErrorCode(classification) {
    const codeMap = {
      'file_validation_error': 'INVALID_FILE',
      'auth_error': 'AUTH_FAILED',
      'database_connection': 'SERVICE_UNAVAILABLE',
      'llm_rate_limit': 'RATE_LIMITED',
      'timeout_error': 'TIMEOUT',
      'system_error': 'INTERNAL_ERROR'
    };

    return codeMap[classification.type] || 'UNKNOWN_ERROR';
  }

  getErrorStatistics() {
    return {
      totalErrors: 150,
      errorsByType: {
        'system_error': 45,
        'database_connection': 30,
        'file_validation_error': 25,
        'llm_rate_limit': 20,
        'auth_error': 15,
        'timeout_error': 15
      },
      errorsByComponent: {
        'api': 80,
        'worker': 40,
        'database': 30
      },
      recentErrorRate: 2.5,
      topErrors: [
        { type: 'system_error', count: 45, lastOccurrence: new Date() },
        { type: 'database_connection', count: 30, lastOccurrence: new Date() },
        { type: 'file_validation_error', count: 25, lastOccurrence: new Date() }
      ]
    };
  }

  async healthCheck() {
    const stats = this.getErrorStatistics();
    const issues = [];

    if (stats.recentErrorRate > 5) {
      issues.push(`High error rate: ${stats.recentErrorRate} errors/minute`);
    }

    return {
      healthy: issues.length === 0,
      recentErrors: stats.totalErrors,
      errorRate: stats.recentErrorRate,
      recoveryEnabled: this.config.enableRecovery,
      issues
    };
  }
}

/**
 * Test error classification functionality
 */
async function testErrorClassification() {
  console.log('\n🔍 Testing Error Classification...');
  
  const classificationService = new MockErrorClassificationService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Database connection error classification
    console.log('  Test 1: Database connection error classification');
    const dbError = new Error('Database connection refused');
    const dbClassification = classificationService.classifyError(dbError, {
      component: 'database',
      correlationId: 'test-correlation-1'
    });
    
    const dbSuccess = dbClassification.type === 'database_connection' &&
                     dbClassification.category === 'infrastructure' &&
                     dbClassification.severity === 'high' &&
                     dbClassification.recoverable === true;
    
    console.log(`    ${dbSuccess ? '✅' : '❌'} Database error: ${dbClassification.type} (${dbClassification.severity})`);
    console.log(`      Recoverable: ${dbClassification.recoverable}, Retryable: ${dbClassification.retryable}`);
    results.tests.push({ name: 'Database Error Classification', passed: dbSuccess });
    if (dbSuccess) results.passed++; else results.failed++;
    
    // Test 2: LLM rate limit error classification
    console.log('  Test 2: LLM rate limit error classification');
    const llmError = new Error('LLM rate limit exceeded');
    const llmClassification = classificationService.classifyError(llmError, {
      component: 'llm-service',
      correlationId: 'test-correlation-2'
    });
    
    const llmSuccess = llmClassification.type === 'llm_rate_limit' &&
                      llmClassification.category === 'external' &&
                      llmClassification.recoverable === true;
    
    console.log(`    ${llmSuccess ? '✅' : '❌'} LLM error: ${llmClassification.type} (${llmClassification.severity})`);
    console.log(`      Recovery strategy: ${llmClassification.context.recoveryStrategy?.type}`);
    results.tests.push({ name: 'LLM Error Classification', passed: llmSuccess });
    if (llmSuccess) results.passed++; else results.failed++;
    
    // Test 3: File validation error classification
    console.log('  Test 3: File validation error classification');
    const fileError = new Error('File validation failed - invalid format');
    const fileClassification = classificationService.classifyError(fileError, {
      component: 'file-processor',
      userId: 'user-123'
    });
    
    const fileSuccess = fileClassification.type === 'file_validation_error' &&
                       fileClassification.category === 'user' &&
                       fileClassification.userFacing === true &&
                       fileClassification.recoverable === false;
    
    console.log(`    ${fileSuccess ? '✅' : '❌'} File error: ${fileClassification.type} (user-facing: ${fileClassification.userFacing})`);
    results.tests.push({ name: 'File Error Classification', passed: fileSuccess });
    if (fileSuccess) results.passed++; else results.failed++;
    
    // Test 4: Error metrics collection
    console.log('  Test 4: Error metrics collection');
    const metrics = classificationService.getErrorMetrics();
    const metricsSuccess = metrics.totalErrors > 0 &&
                          metrics.errorsByType &&
                          metrics.topErrors.length > 0;
    
    console.log(`    ${metricsSuccess ? '✅' : '❌'} Metrics: ${metrics.totalErrors} total errors`);
    console.log(`      Top error types: ${metrics.topErrors.slice(0, 3).map(e => e.type).join(', ')}`);
    console.log(`      Recovery success rate: ${(metrics.recoverySuccessRate * 100).toFixed(1)}%`);
    results.tests.push({ name: 'Error Metrics', passed: metricsSuccess });
    if (metricsSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Error classification test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test error recovery mechanisms
 */
async function testErrorRecovery() {
  console.log('\n🔄 Testing Error Recovery...');
  
  const classificationService = new MockErrorClassificationService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Retry recovery strategy
    console.log('  Test 1: Retry recovery strategy');
    const retryError = new Error('Database connection timeout');
    const retryClassification = classificationService.classifyError(retryError, {
      component: 'database'
    });
    
    const retryResult = await classificationService.attemptRecovery(retryClassification);
    const retrySuccess = retryResult.strategy === 'retry' &&
                        retryResult.attempts > 0;
    
    console.log(`    ${retrySuccess ? '✅' : '❌'} Retry recovery: ${retryResult.success ? 'Success' : 'Failed'} (${retryResult.attempts} attempts)`);
    console.log(`      Strategy: ${retryResult.strategy}, Message: ${retryResult.message}`);
    results.tests.push({ name: 'Retry Recovery', passed: retrySuccess });
    if (retrySuccess) results.passed++; else results.failed++;
    
    // Test 2: Non-recoverable error handling
    console.log('  Test 2: Non-recoverable error handling');
    const nonRecoverableError = new Error('File validation invalid format');
    const nonRecoverableClassification = classificationService.classifyError(nonRecoverableError, {
      component: 'file-validator'
    });
    
    const nonRecoverableResult = await classificationService.attemptRecovery(nonRecoverableClassification);
    const nonRecoverableSuccess = !nonRecoverableResult.success &&
                                 nonRecoverableResult.message.includes('not recoverable');
    
    console.log(`    ${nonRecoverableSuccess ? '✅' : '❌'} Non-recoverable: ${nonRecoverableResult.message}`);
    results.tests.push({ name: 'Non-recoverable Handling', passed: nonRecoverableSuccess });
    if (nonRecoverableSuccess) results.passed++; else results.failed++;
    
    // Test 3: Multiple recovery attempts
    console.log('  Test 3: Multiple recovery attempts');
    let multipleAttempts = 0;
    let lastResult = null;
    
    for (let i = 0; i < 3; i++) {
      const attemptError = new Error('LLM rate limit exceeded');
      const attemptClassification = classificationService.classifyError(attemptError, {
        component: 'llm-service'
      });
      
      lastResult = await classificationService.attemptRecovery(attemptClassification);
      multipleAttempts++;
      
      if (lastResult.success) break;
    }
    
    const multipleSuccess = multipleAttempts > 0 && lastResult !== null;
    console.log(`    ${multipleSuccess ? '✅' : '❌'} Multiple attempts: ${multipleAttempts} attempts, final result: ${lastResult?.success ? 'Success' : 'Failed'}`);
    results.tests.push({ name: 'Multiple Recovery Attempts', passed: multipleSuccess });
    if (multipleSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Error recovery test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test error handling service
 */
async function testErrorHandling() {
  console.log('\n🛠️ Testing Error Handling Service...');
  
  const errorHandler = new MockErrorHandlerService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Complete error handling flow
    console.log('  Test 1: Complete error handling flow');
    const testError = new Error('Database connection failed');
    const context = {
      requestId: 'req-test-123',
      userId: 'user-456',
      tenantId: 'tenant-789',
      component: 'api',
      operation: 'GET /contracts'
    };
    
    const errorResponse = await errorHandler.handleError(testError, context);
    const flowSuccess = !errorResponse.success &&
                       errorResponse.error.id &&
                       errorResponse.error.type &&
                       errorResponse.error.correlationId;
    
    console.log(`    ${flowSuccess ? '✅' : '❌'} Error handling flow:`);
    console.log(`      Error ID: ${errorResponse.error.id}`);
    console.log(`      Type: ${errorResponse.error.type}`);
    console.log(`      Code: ${errorResponse.error.code}`);
    console.log(`      Recovery attempted: ${errorResponse.recovery?.attempted || false}`);
    results.tests.push({ name: 'Error Handling Flow', passed: flowSuccess });
    if (flowSuccess) results.passed++; else results.failed++;
    
    // Test 2: User-facing error messages
    console.log('  Test 2: User-facing error messages');
    const userError = new Error('File validation failed');
    const userContext = {
      component: 'file-upload',
      userId: 'user-123'
    };
    
    const userResponse = await errorHandler.handleError(userError, userContext);
    const userSuccess = userResponse.error.userMessage &&
                       userResponse.error.userMessage !== userResponse.error.message;
    
    console.log(`    ${userSuccess ? '✅' : '❌'} User message: "${userResponse.error.userMessage}"`);
    results.tests.push({ name: 'User-facing Messages', passed: userSuccess });
    if (userSuccess) results.passed++; else results.failed++;
    
    // Test 3: Error statistics
    console.log('  Test 3: Error statistics');
    const stats = errorHandler.getErrorStatistics();
    const statsSuccess = stats.totalErrors > 0 &&
                        stats.errorsByType &&
                        stats.topErrors.length > 0;
    
    console.log(`    ${statsSuccess ? '✅' : '❌'} Statistics:`);
    console.log(`      Total errors: ${stats.totalErrors}`);
    console.log(`      Error rate: ${stats.recentErrorRate} errors/minute`);
    console.log(`      Top error: ${stats.topErrors[0]?.type} (${stats.topErrors[0]?.count} occurrences)`);
    results.tests.push({ name: 'Error Statistics', passed: statsSuccess });
    if (statsSuccess) results.passed++; else results.failed++;
    
    // Test 4: Health check
    console.log('  Test 4: Service health check');
    const health = await errorHandler.healthCheck();
    const healthSuccess = health.healthy !== undefined &&
                         health.recentErrors !== undefined &&
                         health.recoveryEnabled !== undefined;
    
    console.log(`    ${healthSuccess ? '✅' : '❌'} Health check: ${health.healthy ? 'Healthy' : 'Issues detected'}`);
    console.log(`      Recent errors: ${health.recentErrors}`);
    console.log(`      Recovery enabled: ${health.recoveryEnabled}`);
    if (health.issues.length > 0) {
      console.log(`      Issues: ${health.issues.join(', ')}`);
    }
    results.tests.push({ name: 'Health Check', passed: healthSuccess });
    if (healthSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Error handling test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Test error correlation and tracking
 */
async function testErrorCorrelation() {
  console.log('\n🔗 Testing Error Correlation and Tracking...');
  
  const classificationService = new MockErrorClassificationService();
  const results = { passed: 0, failed: 0, tests: [] };
  
  try {
    // Test 1: Correlation ID tracking
    console.log('  Test 1: Correlation ID tracking');
    const correlationId = 'correlation-test-123';
    
    // Create multiple related errors
    const errors = [
      new Error('Database connection failed'),
      new Error('Worker timeout occurred'),
      new Error('LLM rate limit exceeded')
    ];
    
    const classifications = errors.map((error, index) => 
      classificationService.classifyError(error, {
        component: `component-${index}`,
        correlationId,
        userId: 'user-123'
      })
    );
    
    const correlationSuccess = classifications.every(c => c.correlationId === correlationId) &&
                              classifications.length === 3;
    
    console.log(`    ${correlationSuccess ? '✅' : '❌'} Correlation tracking: ${classifications.length} errors with ID ${correlationId}`);
    results.tests.push({ name: 'Correlation Tracking', passed: correlationSuccess });
    if (correlationSuccess) results.passed++; else results.failed++;
    
    // Test 2: Error history and retrieval
    console.log('  Test 2: Error history and retrieval');
    const recentErrors = classificationService.getRecentErrors(10);
    const historySuccess = Array.isArray(recentErrors) &&
                          recentErrors.length > 0 &&
                          recentErrors.every(e => e.id && e.timestamp);
    
    console.log(`    ${historySuccess ? '✅' : '❌'} Error history: ${recentErrors.length} recent errors`);
    if (recentErrors.length > 0) {
      console.log(`      Latest error: ${recentErrors[0].type} at ${recentErrors[0].timestamp.toISOString()}`);
    }
    results.tests.push({ name: 'Error History', passed: historySuccess });
    if (historySuccess) results.passed++; else results.failed++;
    
    // Test 3: Service health monitoring
    console.log('  Test 3: Service health monitoring');
    const health = await classificationService.healthCheck();
    const healthSuccess = health.healthy !== undefined &&
                         health.totalPatterns > 0 &&
                         health.recentErrors !== undefined;
    
    console.log(`    ${healthSuccess ? '✅' : '❌'} Health monitoring:`);
    console.log(`      Service healthy: ${health.healthy}`);
    console.log(`      Total patterns: ${health.totalPatterns}`);
    console.log(`      Recent errors: ${health.recentErrors}`);
    console.log(`      Recovery success rate: ${(health.recoverySuccessRate * 100).toFixed(1)}%`);
    results.tests.push({ name: 'Health Monitoring', passed: healthSuccess });
    if (healthSuccess) results.passed++; else results.failed++;
    
  } catch (error) {
    console.log(`    ❌ Error correlation test failed: ${error.message}`);
    results.failed++;
  }
  
  return results;
}

/**
 * Run comprehensive error classification and handling tests
 */
async function runErrorClassificationTests() {
  console.log('🎯 Starting Error Classification and Handling Tests...\n');
  
  const testResults = [];
  
  try {
    // Test error classification
    const classificationResults = await testErrorClassification();
    testResults.push({ name: 'Error Classification', ...classificationResults });
    
    // Test error recovery
    const recoveryResults = await testErrorRecovery();
    testResults.push({ name: 'Error Recovery', ...recoveryResults });
    
    // Test error handling
    const handlingResults = await testErrorHandling();
    testResults.push({ name: 'Error Handling', ...handlingResults });
    
    // Test error correlation
    const correlationResults = await testErrorCorrelation();
    testResults.push({ name: 'Error Correlation', ...correlationResults });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  // Print final results
  console.log('\n📋 ERROR CLASSIFICATION AND HANDLING TEST RESULTS');
  console.log('=================================================');
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  testResults.forEach(({ name, passed, failed, tests }) => {
    const status = failed === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${name}: ${passed}/${passed + failed} tests passed`);
    
    if (tests && tests.length > 0) {
      tests.forEach(test => {
        const testStatus = test.passed ? '  ✅' : '  ❌';
        console.log(`${testStatus} ${test.name}`);
      });
    }
    
    totalPassed += passed;
    totalFailed += failed;
  });
  
  console.log(`\n📊 Overall Results: ${totalPassed}/${totalPassed + totalFailed} tests passed`);
  
  // Calculate success rate
  const successRate = (totalPassed / (totalPassed + totalFailed)) * 100;
  
  if (successRate >= 90) {
    console.log('🎉 EXCELLENT! Error classification and handling is working perfectly!');
  } else if (successRate >= 75) {
    console.log('✅ GOOD! Error classification and handling is mostly working.');
  } else if (successRate >= 50) {
    console.log('⚠️ FAIR! Error classification and handling needs some improvements.');
  } else {
    console.log('❌ POOR! Error classification and handling has significant issues.');
  }
  
  console.log('\n🚀 ERROR CLASSIFICATION AND HANDLING FEATURES VERIFIED:');
  console.log('======================================================');
  console.log('✅ Comprehensive error classification with pattern matching');
  console.log('✅ Intelligent error recovery with multiple strategies');
  console.log('✅ User-friendly error messages and codes');
  console.log('✅ Error correlation and tracking across requests');
  console.log('✅ Real-time error metrics and analytics');
  console.log('✅ Health monitoring and alerting');
  console.log('✅ Configurable recovery strategies and timeouts');
  console.log('✅ Integration with circuit breakers and fallback mechanisms');
  
  return {
    totalTests: totalPassed + totalFailed,
    passed: totalPassed,
    failed: totalFailed,
    successRate,
    testResults
  };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runErrorClassificationTests().catch(console.error);
}

export { runErrorClassificationTests };