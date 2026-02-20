/**
 * Tests for GET /api/agents/dashboard-stats
 * Aggregated statistics for the AI Insights dashboard
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockAgentEventCount: vi.fn(),
  mockAgentEventFindMany: vi.fn(),
  mockAgentRecommendationCount: vi.fn(),
  mockOpportunityDiscoveryAggregate: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockLearningRecordCount: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentEvent: {
      count: mocks.mockAgentEventCount,
      findMany: mocks.mockAgentEventFindMany,
    },
    agentRecommendation: {
      count: mocks.mockAgentRecommendationCount,
    },
    opportunityDiscovery: {
      aggregate: mocks.mockOpportunityDiscoveryAggregate,
    },
    contract: {
      findMany: mocks.mockContractFindMany,
    },
    learningRecord: {
      count: mocks.mockLearningRecordCount,
    },
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

const BASE = 'http://localhost:3000/api/agents/dashboard-stats';

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/agents/dashboard-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply defaults after clearAllMocks (mockReset: true in config clears implementations)
    mocks.mockAgentEventCount.mockResolvedValue(0);
    mocks.mockAgentRecommendationCount.mockResolvedValue(0);
    mocks.mockOpportunityDiscoveryAggregate.mockResolvedValue({
      _sum: { potentialValue: null },
      _count: 0,
    });
    mocks.mockContractFindMany.mockResolvedValue([]);
    mocks.mockLearningRecordCount.mockResolvedValue(0);
    mocks.mockAgentEventFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE));
    expect(res.status).toBe(401);
  });

  it('returns dashboard stats with all fields', async () => {
    mocks.mockAgentEventCount.mockResolvedValue(42);
    mocks.mockAgentRecommendationCount.mockResolvedValue(5);
    mocks.mockOpportunityDiscoveryAggregate.mockResolvedValue({
      _sum: { potentialValue: 150000 },
      _count: 3,
    });
    mocks.mockContractFindMany.mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' },
    ]);
    mocks.mockLearningRecordCount.mockResolvedValue(10);
    mocks.mockAgentEventFindMany.mockResolvedValue([
      { contractId: 'c1', metadata: { score: 90 } },
      { contractId: 'c2', metadata: { score: 60 } },
    ]);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.totalEvents).toBe(42);
    expect(json.data.activeRecommendations).toBe(5);
    expect(json.data.totalOpportunityValue).toBe(150000);
    expect(json.data.opportunitiesCount).toBe(3);
    expect(json.data.learningRecords).toBe(10);
    expect(json.data.totalContracts).toBe(2);
  });

  it('computes health stats from events (score>=75 healthy, score<50 atRisk)', async () => {
    mocks.mockAgentEventFindMany.mockResolvedValue([
      { contractId: 'c1', metadata: { score: 90 } },
      { contractId: 'c2', metadata: { score: 80 } },
      { contractId: 'c3', metadata: { score: 60 } }, // neither healthy nor atRisk
      { contractId: 'c4', metadata: { score: 30 } },
    ]);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.healthyContracts).toBe(2);
    expect(json.data.atRiskContracts).toBe(1);
    // avgHealthScore = Math.round((90+80+60+30)/4) = Math.round(65) = 65
    expect(json.data.avgHealthScore).toBe(65);
  });

  it('handles zero events gracefully (avgHealthScore = 0)', async () => {
    mocks.mockAgentEventFindMany.mockResolvedValue([]);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.avgHealthScore).toBe(0);
    expect(json.data.healthyContracts).toBe(0);
    expect(json.data.atRiskContracts).toBe(0);
  });

  it('returns correct opportunity value from aggregate', async () => {
    mocks.mockOpportunityDiscoveryAggregate.mockResolvedValue({
      _sum: { potentialValue: 500000 },
      _count: 12,
    });

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.totalOpportunityValue).toBe(500000);
    expect(json.data.opportunitiesCount).toBe(12);
  });
});
