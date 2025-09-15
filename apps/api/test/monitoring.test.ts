import { describe, it, expect } from 'vitest';
import { monitoring } from '../monitoring';

function mockReq(url = '/x', method = 'GET') {
  return { url, method, headers: {}, log: { info() {}, error() {} } } as any;
}
function mockRep() {
  return { statusCode: 200, getHeaders() { return {}; }, header() {} } as any;
}

describe('monitoring basic', () => {
  it('tracks requests and errors', async () => {
    const req = mockReq('/healthz');
    const rep = mockRep();
    await monitoring.onRequest(req, rep);
    await new Promise(r => setTimeout(r, 5)); // simulate latency
    await monitoring.onResponse(req, rep);
  const metrics = monitoring.getMetrics();
  expect(metrics.requests.total).toBeGreaterThan(0);

    const errReq = mockReq('/boom');
    const errRep = mockRep();
    await monitoring.onRequest(errReq, errRep);
    await monitoring.onError(errReq, errRep, new Error('fail'));
  const metrics2 = monitoring.getMetrics();
  expect(metrics2.requests.errors).toBeGreaterThan(0);
  });
});
