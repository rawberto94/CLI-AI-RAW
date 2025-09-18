/**
 * Real-Time Progress Tracking Test
 * Tests WebSocket and SSE progress tracking functionality
 */

import WebSocket from 'ws';
import { EventSource } from 'eventsource';
import fetch from 'node-fetch';

console.log('🔄 TESTING REAL-TIME PROGRESS TRACKING');
console.log('=====================================');

const API_BASE = 'http://localhost:3001';
const WS_BASE = 'ws://localhost:3001';
const TENANT_ID = 'test-tenant';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds
  expectedStages: [
    'upload_validation',
    'file_extraction', 
    'content_analysis',
    'template_analysis',
    'financial_analysis',
    'enhanced_overview',
    'clauses_analysis',
    'rates_analysis',
    'risk_assessment',
    'compliance_check',
    'benchmark_analysis',
    'artifact_generation',
    'indexation',
    'completed'
  ]
};

/**
 * Test WebSocket progress tracking
 */
async function testWebSocketProgress() {
  console.log('\n🔌 Testing WebSocket Progress Tracking...');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket test timeout'));
    }, TEST_CONFIG.timeout);

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/progress?tenantId=${TENANT_ID}`);
      const receivedMessages = [];
      let contractId = null;

      ws.on('open', () => {
        console.log('✅ WebSocket connected');
        
        // Start a test upload to generate progress
        startTestUpload().then(docId => {
          contractId = docId;
          console.log(`📄 Started test upload: ${docId}`);
          
          // Subscribe to the specific contract
          ws.send(JSON.stringify({
            type: 'subscribe',
            contractId: docId
          }));
        }).catch(reject);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          receivedMessages.push(message);
          
          console.log(`📨 WebSocket message: ${message.type}`, {
            contractId: message.contractId,
            stage: message.data?.stage,
            progress: message.data?.progress
          });

          // Check if we received completion
          if (message.type === 'completed' || 
              (message.type === 'progress' && message.data?.progress === 100)) {
            clearTimeout(timeout);
            ws.close();
            
            console.log('✅ WebSocket progress tracking completed');
            console.log(`📊 Received ${receivedMessages.length} messages`);
            
            resolve({
              success: true,
              messagesReceived: receivedMessages.length,
              contractId,
              finalProgress: message.data?.progress || 100
            });
          }
        } catch (error) {
          console.error('❌ WebSocket message parse error:', error);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ WebSocket error:', error);
        reject(error);
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
      });

    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

/**
 * Test Server-Sent Events progress tracking
 */
async function testSSEProgress() {
  console.log('\n📡 Testing SSE Progress Tracking...');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('SSE test timeout'));
    }, TEST_CONFIG.timeout);

    try {
      const eventSource = new EventSource(`${API_BASE}/contracts/progress/stream?tenantId=${TENANT_ID}`);
      const receivedEvents = [];
      let contractId = null;

      eventSource.onopen = () => {
        console.log('✅ SSE connection opened');
        
        // Start a test upload to generate progress
        startTestUpload().then(docId => {
          contractId = docId;
          console.log(`📄 Started test upload for SSE: ${docId}`);
        }).catch(reject);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          receivedEvents.push(data);
          
          console.log(`📨 SSE event: ${event.type || 'message'}`, {
            contractId: data.contractId,
            stage: data.progress?.stage,
            progress: data.progress?.progress
          });
        } catch (error) {
          console.error('❌ SSE message parse error:', error);
        }
      };

      eventSource.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.progress?.progress === 100 || data.progress?.stage === 'completed') {
            clearTimeout(timeout);
            eventSource.close();
            
            console.log('✅ SSE progress tracking completed');
            console.log(`📊 Received ${receivedEvents.length} events`);
            
            resolve({
              success: true,
              eventsReceived: receivedEvents.length,
              contractId: data.contractId,
              finalProgress: data.progress?.progress || 100
            });
          }
        } catch (error) {
          console.error('❌ SSE progress event parse error:', error);
        }
      });

      eventSource.addEventListener('completed', (event) => {
        clearTimeout(timeout);
        eventSource.close();
        
        console.log('✅ SSE completion event received');
        resolve({
          success: true,
          eventsReceived: receivedEvents.length,
          contractId,
          completed: true
        });
      });

      eventSource.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ SSE error:', error);
        eventSource.close();
        reject(error);
      };

    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

/**
 * Test REST API progress endpoints
 */
async function testRESTProgress() {
  console.log('\n🌐 Testing REST Progress API...');
  
  try {
    // Start a test upload
    const contractId = await startTestUpload();
    console.log(`📄 Started test upload for REST: ${contractId}`);
    
    // Poll progress via REST API
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      const response = await fetch(`${API_BASE}/contracts/${contractId}/progress`, {
        headers: {
          'x-tenant-id': TENANT_ID
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const progress = await response.json();
      
      console.log(`📊 REST Progress (${attempts + 1}/${maxAttempts}):`, {
        stage: progress.stage,
        progress: progress.progress,
        message: progress.message,
        estimatedTimeRemaining: progress.estimatedTimeRemaining
      });
      
      if (progress.progress === 100 || progress.stage === 'completed') {
        console.log('✅ REST progress tracking completed');
        return {
          success: true,
          attempts: attempts + 1,
          contractId,
          finalProgress: progress.progress
        };
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }
    
    throw new Error('REST progress test timeout - max attempts reached');
    
  } catch (error) {
    console.error('❌ REST progress test failed:', error);
    throw error;
  }
}

/**
 * Test progress metrics endpoint
 */
async function testProgressMetrics() {
  console.log('\n📈 Testing Progress Metrics...');
  
  try {
    const response = await fetch(`${API_BASE}/metrics/progress`, {
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const metrics = await response.json();
    
    console.log('📊 Progress Metrics:', {
      totalConnections: metrics.realTimeConnections?.total || 0,
      sseConnections: metrics.realTimeConnections?.sse?.totalConnections || 0,
      wsConnections: metrics.realTimeConnections?.websocket?.totalConnections || 0,
      activeContracts: metrics.activeProgress?.totalContracts || 0
    });
    
    return {
      success: true,
      metrics
    };
    
  } catch (error) {
    console.error('❌ Progress metrics test failed:', error);
    throw error;
  }
}

/**
 * Start a test upload to generate progress events
 */
async function startTestUpload() {
  try {
    // Initialize signed upload
    const initResponse = await fetch(`${API_BASE}/uploads/init-signed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID
      },
      body: JSON.stringify({
        filename: 'test-contract.pdf',
        contentType: 'application/pdf',
        size: 1024000
      })
    });
    
    if (!initResponse.ok) {
      throw new Error(`Init upload failed: ${initResponse.status}`);
    }
    
    const initData = await initResponse.json();
    
    // Simulate upload completion
    const finalizeResponse = await fetch(`${API_BASE}/uploads/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID
      },
      body: JSON.stringify({
        docId: initData.docId,
        filename: 'test-contract.pdf',
        storagePath: initData.storagePath
      })
    });
    
    if (!finalizeResponse.ok) {
      throw new Error(`Finalize upload failed: ${finalizeResponse.status}`);
    }
    
    return initData.docId;
    
  } catch (error) {
    console.error('❌ Test upload failed:', error);
    throw error;
  }
}

/**
 * Run all progress tracking tests
 */
async function runAllTests() {
  const results = {
    websocket: null,
    sse: null,
    rest: null,
    metrics: null
  };
  
  try {
    console.log('🚀 Starting Real-Time Progress Tracking Tests...\n');
    
    // Test REST API first (baseline)
    try {
      results.rest = await testRESTProgress();
      console.log('✅ REST API test passed');
    } catch (error) {
      console.error('❌ REST API test failed:', error.message);
      results.rest = { success: false, error: error.message };
    }
    
    // Test WebSocket
    try {
      results.websocket = await testWebSocketProgress();
      console.log('✅ WebSocket test passed');
    } catch (error) {
      console.error('❌ WebSocket test failed:', error.message);
      results.websocket = { success: false, error: error.message };
    }
    
    // Test SSE
    try {
      results.sse = await testSSEProgress();
      console.log('✅ SSE test passed');
    } catch (error) {
      console.error('❌ SSE test failed:', error.message);
      results.sse = { success: false, error: error.message };
    }
    
    // Test metrics
    try {
      results.metrics = await testProgressMetrics();
      console.log('✅ Metrics test passed');
    } catch (error) {
      console.error('❌ Metrics test failed:', error.message);
      results.metrics = { success: false, error: error.message };
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  // Print final results
  console.log('\n📋 FINAL TEST RESULTS');
  console.log('=====================');
  
  const testResults = [
    { name: 'REST API Progress', result: results.rest },
    { name: 'WebSocket Progress', result: results.websocket },
    { name: 'SSE Progress', result: results.sse },
    { name: 'Progress Metrics', result: results.metrics }
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
    console.log('🎉 All real-time progress tracking tests passed!');
    console.log('\n✨ Real-time progress tracking system is working correctly!');
  } else {
    console.log('⚠️ Some tests failed. Check the errors above.');
  }
  
  return results;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, testWebSocketProgress, testSSEProgress, testRESTProgress, testProgressMetrics };