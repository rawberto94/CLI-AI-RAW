/**
 * K6 Smoke Test - Basic API Health Check
 * 
 * Run: k6 run tests/load/k6-smoke.js --env BASE_URL=http://localhost:3000
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthCheckDuration = new Trend('health_check_duration');

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Health check endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`);
  healthCheckDuration.add(healthRes.timings.duration);
  
  const healthCheck = check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
    'health body contains status': (r) => r.body && r.body.includes('status'),
  });
  
  errorRate.add(!healthCheck);
  
  // Readiness check
  const readyRes = http.get(`${BASE_URL}/api/health/ready`);
  check(readyRes, {
    'readiness status is 200': (r) => r.status === 200,
  });
  
  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/results/smoke-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const checks = data.metrics.checks;
  const reqs = data.metrics.http_reqs;
  const duration = data.metrics.http_req_duration;
  
  return `
╔══════════════════════════════════════════════════════════════╗
║                    K6 SMOKE TEST RESULTS                     ║
╠══════════════════════════════════════════════════════════════╣
║ Total Requests: ${reqs?.values?.count || 'N/A'}
║ Failed Requests: ${data.metrics.http_req_failed?.values?.rate ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) + '%' : 'N/A'}
║ 
║ Response Times:
║   - Average: ${duration?.values?.avg ? duration.values.avg.toFixed(2) + 'ms' : 'N/A'}
║   - P95: ${duration?.values?.['p(95)'] ? duration.values['p(95)'].toFixed(2) + 'ms' : 'N/A'}
║   - P99: ${duration?.values?.['p(99)'] ? duration.values['p(99)'].toFixed(2) + 'ms' : 'N/A'}
║
║ Checks Passed: ${checks?.values?.passes || 0}/${(checks?.values?.passes || 0) + (checks?.values?.fails || 0)}
╚══════════════════════════════════════════════════════════════╝
`;
}
