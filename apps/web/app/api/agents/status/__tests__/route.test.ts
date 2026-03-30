/**
 * Tests for GET /api/agents/status
 * Agent Ecosystem Status Dashboard API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSetex: vi.fn().mockResolvedValue('OK'),
  mockAgentPerformanceLogGroupBy: vi.fn().mockResolvedValue([]),
  mockAgentPerformanceLogCount: vi.fn().mockResolvedValue(0),
  mockAgentPerformanceLogAggregate: vi.fn().mockResolvedValue({ _avg: { duration: null } }),
  mockAgentGoalCount: vi.fn().mockResolvedValue(0),
  mockAgentGoalGroupBy: vi.fn().mockResolvedValue([]),
  mockRFxEventCount: vi.fn().mockResolvedValue(0),
  mockRiskDetectionLogCount: vi.fn().mockResolvedValue(0),
  mockContractCount: vi.fn().mockResolvedValue(0),
  mockAgentEventFindMany: vi.fn().mockResolvedValue([]),
  mockRFxOpportunityCount: vi.fn().mockResolvedValue(0),
  mockRFxOpportunityGroupBy: vi.fn().mockResolvedValue([]),
  mockRFxOpportunityAggregate: vi.fn().mockResolvedValue({ _sum: { savingsPotential: null } }),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentPerformanceLog: {
      groupBy: mocks.mockAgentPerformanceLogGroupBy,
      count: mocks.mockAgentPerformanceLogCount,
      aggregate: mocks.mockAgentPerformanceLogAggregate,
    },
    agentGoal: {
      count: mocks.mockAgentGoalCount,
      groupBy: mocks.mockAgentGoalGroupBy,
    },
    rFxEvent: {
      count: mocks.mockRFxEventCount,
    },
    riskDetectionLog: {
      count: mocks.mockRiskDetectionLogCount,
    },
    contract: {
      count: mocks.mockContractCount,
    },
    agentEvent: {
      findMany: mocks.mockAgentEventFindMany,
    },
    rFxOpportunity: {
      count: mocks.mockRFxOpportunityCount,
      groupBy: mocks.mockRFxOpportunityGroupBy,
      aggregate: mocks.mockRFxOpportunityAggregate,
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: mocks.mockRedisGet,
    setex: mocks.mockRedisSetex,
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

const BASE = 'http://localhost:3000/api/agents/status';

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/agents/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default return values after clearAllMocks
    mocks.mockRedisGet.mockResolvedValue(null);
    mocks.mockRedisSetex.mockResolvedValue('OK');
    mocks.mockAgentPerformanceLogGroupBy.mockResolvedValue([]);
    mocks.mockAgentPerformanceLogCount.mockResolvedValue(0);
    mocks.mockAgentPerformanceLogAggregate.mockResolvedValue({ _avg: { duration: null } });
    mocks.mockAgentGoalCount.mockResolvedValue(0);
    mocks.mockAgentGoalGroupBy.mockResolvedValue([]);
    mocks.mockRFxEventCount.mockResolvedValue(0);
    mocks.mockRiskDetectionLogCount.mockResolvedValue(0);
    mocks.mockContractCount.mockResolvedValue(0);
    mocks.mockAgentEventFindMany.mockResolvedValue([]);
    mocks.mockRFxOpportunityCount.mockResolvedValue(0);
    mocks.mockRFxOpportunityGroupBy.mockResolvedValue([]);
    mocks.mockRFxOpportunityAggregate.mockResolvedValue({ _sum: { savingsPotential: null } });
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns cached response when available', async () => {
    const cached = JSON.stringify({
      overview: { totalAgents: 15, activeAgents: 12, pendingApprovals: 3 },
    });
    mocks.mockRedisGet.mockResolvedValue(cached);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.overview.totalAgents).toBe(15);
    expect(mocks.mockAgentPerformanceLogGroupBy).not.toHaveBeenCalled();
  });

  it('returns dashboard status on cache miss', async () => {
    mocks.mockRedisGet.mockResolvedValue(null);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.overview).toBeDefined();
    expect(json.data.overview.totalAgents).toBe(21);
    expect(json.data.clusters).toBeInstanceOf(Array);
    expect(json.data.clusters).toHaveLength(5);
    expect(json.data.metrics).toBeDefined();
    expect(json.data.recentActivity).toBeInstanceOf(Array);
    expect(json.data.quickActions).toBeInstanceOf(Array);
  });

  it('caches the response in redis', async () => {
    mocks.mockRedisGet.mockResolvedValue(null);

    await GET(authReq(BASE));
    expect(mocks.mockRedisSetex).toHaveBeenCalledWith(
      'status:tenant-1',
      30,
      expect.any(String),
    );
  });

  it('returns 500 when data gathering fails', async () => {
    mocks.mockRedisGet.mockResolvedValue(null);
    mocks.mockAgentPerformanceLogGroupBy.mockRejectedValue(new Error('DB down'));

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
