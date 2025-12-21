/**
 * Load Testing Script for Contract Intelligence Platform
 * Uses k6 (https://k6.io) for load testing
 * 
 * Install: brew install k6  OR  docker pull grafana/k6
 * 
 * Run:
 *   k6 run scripts/load-test.js
 *   k6 run --vus 50 --duration 5m scripts/load-test.js
 *   k6 run --env BASE_URL=https://staging.yourapp.com scripts/load-test.js
 * 
 * Docker:
 *   docker run -i grafana/k6 run - <scripts/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthCheckDuration = new Trend('health_check_duration');
const apiLatency = new Trend('api_latency');

// Test configuration
export const options = {
  // Stages for ramping up/down load
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 20 },    // Ramp up to 20 users
    { duration: '2m', target: 20 },    // Stay at 20 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  
  // Thresholds for pass/fail
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],      // Error rate under 5%
    errors: ['rate<0.1'],                // Custom error rate under 10%
    health_check_duration: ['p(99)<500'], // Health checks under 500ms
    api_latency: ['p(95)<3000'],         // API latency under 3s at p95
  },
  
  // Tags for organization
  tags: {
    testType: 'load',
  },
};

// Base URL - can be overridden with --env BASE_URL=...
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3005';
const TENANT_ID = __ENV.TENANT_ID || 'demo';

// Common headers
const headers = {
  'Content-Type': 'application/json',
  'x-tenant-id': TENANT_ID,
};

// Helper function for API requests
function apiRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const params = { headers, timeout: '30s' };
  
  let response;
  const start = Date.now();
  
  switch (method.toUpperCase()) {
    case 'GET':
      response = http.get(url, params);
      break;
    case 'POST':
      response = http.post(url, JSON.stringify(body), params);
      break;
    case 'PUT':
      response = http.put(url, JSON.stringify(body), params);
      break;
    case 'DELETE':
      response = http.del(url, null, params);
      break;
    default:
      response = http.get(url, params);
  }
  
  apiLatency.add(Date.now() - start);
  return response;
}

// Main test function
export default function () {
  // ===================================
  // Health Check Tests
  // ===================================
  group('Health Checks', () => {
    const start = Date.now();
    const healthRes = http.get(`${BASE_URL}/api/health`);
    healthCheckDuration.add(Date.now() - start);
    
    const healthCheck = check(healthRes, {
      'health check status is 200': (r) => r.status === 200,
      'health check returns ok': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'ok';
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!healthCheck);
    
    // Detailed health check
    const detailedHealth = http.get(`${BASE_URL}/api/monitoring/health`);
    check(detailedHealth, {
      'detailed health returns 200 or 503': (r) => r.status === 200 || r.status === 503,
      'detailed health has checks': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.checks !== undefined;
        } catch {
          return false;
        }
      },
    });
  });
  
  sleep(0.5);
  
  // ===================================
  // Contract API Tests
  // ===================================
  group('Contract API', () => {
    // List contracts
    const listRes = apiRequest('GET', '/api/contracts?page=1&limit=10');
    const listCheck = check(listRes, {
      'contract list status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'contract list response time OK': (r) => r.timings.duration < 3000,
    });
    errorRate.add(!listCheck);
    
    // Get single contract (if we have one)
    if (listRes.status === 200) {
      try {
        const body = JSON.parse(listRes.body);
        if (body.contracts && body.contracts.length > 0) {
          const contractId = body.contracts[0].id;
          const detailRes = apiRequest('GET', `/api/contracts/${contractId}`);
          check(detailRes, {
            'contract detail returns 200': (r) => r.status === 200,
          });
        }
      } catch {
        // Ignore parse errors
      }
    }
  });
  
  sleep(0.5);
  
  // ===================================
  // Rate Card API Tests
  // ===================================
  group('Rate Card API', () => {
    const rateCardRes = apiRequest('GET', '/api/rate-cards');
    check(rateCardRes, {
      'rate cards status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'rate cards response time OK': (r) => r.timings.duration < 3000,
    });
  });
  
  sleep(0.5);
  
  // ===================================
  // Dashboard API Tests
  // ===================================
  group('Dashboard API', () => {
    const dashboardRes = apiRequest('GET', '/api/dashboard/metrics');
    const dashCheck = check(dashboardRes, {
      'dashboard metrics status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'dashboard response time OK': (r) => r.timings.duration < 5000,
    });
    errorRate.add(!dashCheck);
  });
  
  sleep(0.5);
  
  // ===================================
  // Search API Tests
  // ===================================
  group('Search API', () => {
    const searchRes = apiRequest('GET', '/api/contracts?search=test');
    check(searchRes, {
      'search status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'search response time OK': (r) => r.timings.duration < 5000,
    });
  });
  
  sleep(1);
}

// Setup function - runs once before all VUs
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log(`Tenant ID: ${TENANT_ID}`);
  
  // Verify the server is up
  const healthRes = http.get(`${BASE_URL}/api/health`);
  if (healthRes.status !== 200) {
    console.error('Server is not responding to health checks!');
  }
  
  return { startTime: new Date().toISOString() };
}

// Teardown function - runs once after all VUs complete
export function teardown(data) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
}

// Handle summary for custom reporting
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

// Text summary helper
function textSummary(data, options) {
  const { metrics } = data;
  const indent = options.indent || '';
  
  let summary = `
${indent}===== Load Test Summary =====
${indent}
${indent}HTTP Requests:
${indent}  Total: ${metrics.http_reqs?.values?.count || 0}
${indent}  Failed: ${metrics.http_req_failed?.values?.rate ? (metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%
${indent}
${indent}Response Times:
${indent}  Avg: ${metrics.http_req_duration?.values?.avg?.toFixed(2) || 0}ms
${indent}  P95: ${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}ms
${indent}  P99: ${metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 0}ms
${indent}  Max: ${metrics.http_req_duration?.values?.max?.toFixed(2) || 0}ms
${indent}
${indent}Custom Metrics:
${indent}  Error Rate: ${metrics.errors?.values?.rate ? (metrics.errors.values.rate * 100).toFixed(2) : 0}%
${indent}  Health Check P99: ${metrics.health_check_duration?.values?.['p(99)']?.toFixed(2) || 0}ms
${indent}  API Latency P95: ${metrics.api_latency?.values?.['p(95)']?.toFixed(2) || 0}ms
${indent}
${indent}Thresholds:
`;

  if (data.root_group?.checks) {
    for (const [name, check] of Object.entries(data.root_group.checks)) {
      const passes = check.passes || 0;
      const fails = check.fails || 0;
      const total = passes + fails;
      const passRate = total > 0 ? ((passes / total) * 100).toFixed(1) : 0;
      summary += `${indent}  ${name}: ${passRate}% passed\n`;
    }
  }
  
  return summary;
}
