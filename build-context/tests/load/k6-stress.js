/**
 * K6 Stress Test - Find Breaking Points
 * 
 * Run: k6 run tests/load/k6-stress.js --env BASE_URL=http://localhost:3000
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTimes = new Trend('response_times');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp to 100 users
    { duration: '5m', target: 100 },   // Hold at 100
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '5m', target: 200 },   // Hold at 200
    { duration: '2m', target: 300 },   // Ramp to 300
    { duration: '5m', target: 300 },   // Hold at 300
    { duration: '2m', target: 400 },   // Ramp to 400 (stress point)
    { duration: '5m', target: 400 },   // Hold at 400
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.15'],     // Allow up to 15% failures in stress test
    http_req_duration: ['p(95)<10000'], // 10s timeout
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/health`, null, { tags: { name: 'health' } }],
    ['GET', `${BASE_URL}/api/health/ready`, null, { tags: { name: 'ready' } }],
  ]);
  
  responses.forEach((res) => {
    const passed = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 5s': (r) => r.timings.duration < 5000,
    });
    
    errorRate.add(!passed);
    responseTimes.add(res.timings.duration);
  });
  
  sleep(0.5);
}

export function handleSummary(data) {
  const duration = data.metrics.http_req_duration;
  const failed = data.metrics.http_req_failed;
  
  // Determine breaking point
  let breakingPoint = 'Not reached';
  if (failed?.values?.rate > 0.1) {
    breakingPoint = 'System showed degradation above 10% error rate';
  }
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   K6 STRESS TEST RESULTS                     ║
╠══════════════════════════════════════════════════════════════╣
║ Peak VUs: ${data.metrics.vus_max?.values?.value || 'N/A'}
║ Total Requests: ${data.metrics.http_reqs?.values?.count || 'N/A'}
║ 
║ Response Times:
║   - Average: ${duration?.values?.avg?.toFixed(2) || 'N/A'}ms
║   - P95: ${duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms
║   - Max: ${duration?.values?.max?.toFixed(2) || 'N/A'}ms
║
║ Error Rate: ${failed?.values?.rate ? (failed.values.rate * 100).toFixed(2) + '%' : 'N/A'}
║ Breaking Point: ${breakingPoint}
╚══════════════════════════════════════════════════════════════╝
  `);
  
  return {
    'tests/load/results/stress-summary.json': JSON.stringify(data, null, 2),
  };
}
