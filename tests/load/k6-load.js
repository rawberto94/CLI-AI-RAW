/**
 * K6 Load Test - API Performance Under Load
 * 
 * Run: k6 run tests/load/k6-load.js --env BASE_URL=http://localhost:3000 --env API_TOKEN=your-token
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');
const contractsLoaded = new Counter('contracts_loaded');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
    'http_req_duration{name:contracts_list}': ['p(95)<1000'],
    'http_req_duration{name:contract_detail}': ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_TOKEN = __ENV.API_TOKEN || '';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': API_TOKEN ? `Bearer ${API_TOKEN}` : '',
};

// Simulated contract IDs for testing
const CONTRACT_IDS = ['contract-1', 'contract-2', 'contract-3'];

export function setup() {
  // Verify API is accessible
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`API not healthy: ${res.status}`);
  }
  return { startTime: Date.now() };
}

export default function () {
  group('Public Endpoints', () => {
    // Health check
    const healthRes = http.get(`${BASE_URL}/api/health`, {
      tags: { name: 'health_check' },
    });
    check(healthRes, {
      'health: status 200': (r) => r.status === 200,
    });
  });

  group('Authenticated API', () => {
    // List contracts
    const listRes = http.get(`${BASE_URL}/api/contracts?limit=20`, {
      headers,
      tags: { name: 'contracts_list' },
    });
    
    const listCheck = check(listRes, {
      'contracts list: status 200 or 401': (r) => r.status === 200 || r.status === 401,
      'contracts list: response time OK': (r) => r.timings.duration < 2000,
    });
    
    apiDuration.add(listRes.timings.duration);
    errorRate.add(!listCheck);
    
    if (listRes.status === 200) {
      contractsLoaded.add(1);
    }
    
    sleep(0.5);
    
    // Get single contract
    const contractId = CONTRACT_IDS[Math.floor(Math.random() * CONTRACT_IDS.length)];
    const detailRes = http.get(`${BASE_URL}/api/contracts/${contractId}`, {
      headers,
      tags: { name: 'contract_detail' },
    });
    
    check(detailRes, {
      'contract detail: valid response': (r) => r.status === 200 || r.status === 401 || r.status === 404,
    });
    
    apiDuration.add(detailRes.timings.duration);
  });

  group('Search Functionality', () => {
    const searchRes = http.get(`${BASE_URL}/api/contracts/search?q=test`, {
      headers,
      tags: { name: 'contract_search' },
    });
    
    check(searchRes, {
      'search: valid response': (r) => r.status === 200 || r.status === 401,
      'search: response time < 3s': (r) => r.timings.duration < 3000,
    });
    
    apiDuration.add(searchRes.timings.duration);
  });

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration.toFixed(2)} seconds`);
}

export function handleSummary(data) {
  return {
    'tests/load/results/load-summary.json': JSON.stringify(data, null, 2),
    'tests/load/results/load-summary.html': htmlReport(data),
  };
}

function htmlReport(data) {
  const duration = data.metrics.http_req_duration;
  const requests = data.metrics.http_reqs;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>K6 Load Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
    .metric { background: #f5f5f5; padding: 20px; margin: 10px 0; border-radius: 8px; }
    .metric h3 { margin: 0 0 10px 0; }
    .value { font-size: 24px; font-weight: bold; color: #333; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
  </style>
</head>
<body>
  <h1>K6 Load Test Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  
  <div class="grid">
    <div class="metric">
      <h3>Total Requests</h3>
      <div class="value">${requests?.values?.count || 'N/A'}</div>
    </div>
    <div class="metric">
      <h3>Avg Response Time</h3>
      <div class="value">${duration?.values?.avg ? duration.values.avg.toFixed(2) + 'ms' : 'N/A'}</div>
    </div>
    <div class="metric">
      <h3>P95 Response Time</h3>
      <div class="value">${duration?.values?.['p(95)'] ? duration.values['p(95)'].toFixed(2) + 'ms' : 'N/A'}</div>
    </div>
    <div class="metric">
      <h3>Error Rate</h3>
      <div class="value ${data.metrics.http_req_failed?.values?.rate < 0.05 ? 'pass' : 'fail'}">
        ${data.metrics.http_req_failed?.values?.rate ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) + '%' : 'N/A'}
      </div>
    </div>
  </div>
</body>
</html>
`;
}
