/**
 * Tests for GET /api/agents/health
 * Contract health assessment endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockAgentEventFindFirst: vi.fn(),
  mockContractFindUnique: vi.fn(),
  mockExecuteWithTracking: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentEvent: { findFirst: mocks.mockAgentEventFindFirst },
    contract: { findUnique: mocks.mockContractFindUnique },
  },
}));

vi.mock('@repo/workers/agents', () => ({
  contractHealthMonitor: {
    executeWithTracking: mocks.mockExecuteWithTracking,
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

// ── Import route AFTER mocks ──────────────────────────────────────────

import { GET } from '../route';

// ── Helpers ────────────────────────────────────────────────────────────

function authReq(url: string) {
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
  });
}

function noAuthReq(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

const BASE = 'http://localhost:3000/api/agents/health';

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/agents/health', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(`${BASE}?contractId=c1`));
    expect(res.status).toBe(401);
  });

  it('returns 400 without contractId', async () => {
    const res = await GET(authReq(BASE));
    expect(res.status).toBe(400);
  });

  it('returns cached health report when available', async () => {
    const cachedHealth = {
      overallScore: 85,
      riskFactors: [],
      recommendations: [],
    };
    mocks.mockAgentEventFindFirst.mockResolvedValue({
      metadata: cachedHealth,
      timestamp: new Date(),
    });

    const res = await GET(authReq(`${BASE}?contractId=c1`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cached).toBe(true);
    expect(json.data.health).toEqual(cachedHealth);
  });

  it('returns 404 when contract not found', async () => {
    mocks.mockAgentEventFindFirst.mockResolvedValue(null);
    mocks.mockContractFindUnique.mockResolvedValue(null);

    const res = await GET(authReq(`${BASE}?contractId=c1`));
    expect(res.status).toBe(404);
  });

  it('runs fresh health assessment', async () => {
    mocks.mockAgentEventFindFirst.mockResolvedValue(null);
    mocks.mockContractFindUnique.mockResolvedValue({
      id: 'c1', contractTitle: 'NDA', artifacts: [],
    });
    mocks.mockExecuteWithTracking.mockResolvedValue({
      success: true,
      data: { overallScore: 92, riskFactors: ['expiry'] },
      reasoning: 'Healthy contract',
    });

    const res = await GET(authReq(`${BASE}?contractId=c1`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cached).toBe(false);
    expect(json.data.health.overallScore).toBe(92);
  });

  it('forces refresh when refresh=true', async () => {
    const res = await GET(authReq(`${BASE}?contractId=c1&refresh=true`));
    // Should NOT check cache
    expect(mocks.mockAgentEventFindFirst).not.toHaveBeenCalled();
    // Will proceed to contract fetch
  });

  it('returns 500 when agent execution fails', async () => {
    mocks.mockAgentEventFindFirst.mockResolvedValue(null);
    mocks.mockContractFindUnique.mockResolvedValue({
      id: 'c1', contractTitle: 'Test', artifacts: [],
    });
    mocks.mockExecuteWithTracking.mockResolvedValue({
      success: false,
      reasoning: 'Agent timed out',
    });

    const res = await GET(authReq(`${BASE}?contractId=c1`));
    expect(res.status).toBe(500);
  });
});
