/**
 * Tests for GET /api/agents/status
 * Agent events and recommendations for a contract
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockAgentEventFindMany: vi.fn(),
  mockAgentRecommendationFindMany: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mocks.mockContractFindFirst,
    },
    agentEvent: {
      findMany: mocks.mockAgentEventFindMany,
    },
    agentRecommendation: {
      findMany: mocks.mockAgentRecommendationFindMany,
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

const BASE = 'http://localhost:3000/api/agents/status';

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/agents/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockContractFindFirst.mockResolvedValue(null);
    mocks.mockAgentEventFindMany.mockResolvedValue([]);
    mocks.mockAgentRecommendationFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(`${BASE}?contractId=c1`));
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing contractId', async () => {
    const res = await GET(authReq(BASE));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('contractId');
  });

  it('returns 404 when contract not found', async () => {
    mocks.mockContractFindFirst.mockResolvedValue(null);

    const res = await GET(authReq(`${BASE}?contractId=nonexistent`));
    expect(res.status).toBe(404);
  });

  it('returns events and recommendations for contract', async () => {
    mocks.mockContractFindFirst.mockResolvedValue({ id: 'c1' });
    mocks.mockAgentEventFindMany.mockResolvedValue([
      {
        id: 'e1',
        agentName: 'contract-health-monitor',
        eventType: 'health_assessment',
        timestamp: new Date('2024-06-01'),
        outcome: 'healthy',
        metadata: { score: 85 },
        reasoning: 'Contract is in good shape',
        confidence: 0.92,
      },
    ]);
    mocks.mockAgentRecommendationFindMany.mockResolvedValue([
      {
        id: 'r1',
        agentName: 'contract-health-monitor',
        action: 'review_clause',
        description: 'Consider updating indemnity clause',
        priority: 'high',
        automated: false,
        estimatedImpact: { severity: 'medium' },
        potentialValue: 10000,
        confidence: 0.85,
        status: 'pending',
        createdAt: new Date('2024-06-01'),
      },
    ]);

    const res = await GET(authReq(`${BASE}?contractId=c1`));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.events).toHaveLength(1);
    expect(json.data.events[0].id).toBe('e1');
    expect(json.data.events[0].metadata.score).toBe(85);

    expect(json.data.recommendations).toHaveLength(1);
    expect(json.data.recommendations[0].id).toBe('r1');
    expect(json.data.recommendations[0].action).toBe('review_clause');
  });

  it('filters by agentName', async () => {
    mocks.mockContractFindFirst.mockResolvedValue({ id: 'c1' });
    mocks.mockAgentEventFindMany.mockResolvedValue([]);
    mocks.mockAgentRecommendationFindMany.mockResolvedValue([]);

    const res = await GET(authReq(`${BASE}?contractId=c1&agentName=compliance-checker`));
    expect(res.status).toBe(200);

    // Verify that agentName filter was passed to the query
    expect(mocks.mockAgentEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ agentName: 'compliance-checker' }),
      }),
    );
  });
});
