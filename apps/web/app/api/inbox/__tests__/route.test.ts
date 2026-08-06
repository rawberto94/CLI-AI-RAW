/**
 * Tests for GET /api/inbox aggregation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockAiDecisionFindMany: vi.fn(),
  mockAgentGoalFindMany: vi.fn(),
  mockWorkflowFindMany: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockRfxFindMany: vi.fn(),
  mockRiskFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiDecision: { findMany: mocks.mockAiDecisionFindMany },
    agentGoal: { findMany: mocks.mockAgentGoalFindMany },
    workflowExecution: { findMany: mocks.mockWorkflowFindMany },
    contract: { findMany: mocks.mockContractFindMany },
    rFxEvent: { findMany: mocks.mockRfxFindMany },
    riskDetectionLog: { findMany: mocks.mockRiskFindMany },
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

import { GET } from '../route';

function authReq(url: string) {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
    },
  });
}

describe('GET /api/inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAiDecisionFindMany.mockResolvedValue([]);
    mocks.mockAgentGoalFindMany.mockResolvedValue([]);
    mocks.mockWorkflowFindMany.mockResolvedValue([]);
    // contract findMany is used twice (metadata review + renewals)
    mocks.mockContractFindMany.mockResolvedValue([]);
    mocks.mockRfxFindMany.mockResolvedValue([]);
    mocks.mockRiskFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    const res = await GET(new NextRequest('http://localhost/api/inbox'));
    expect(res.status).toBe(401);
  });

  it('aggregates agent writes and goals into sorted inbox items', async () => {
    mocks.mockAiDecisionFindMany.mockResolvedValue([
      {
        id: 'dec-1',
        tenantId: 'tenant-1',
        contractId: 'c1',
        feature: 'agent_write',
        outcome: 'pending',
        outputType: 'agent_field_write',
        model: 'agent-a',
        confidence: 0.4,
        citations: [],
        evidenceChain: [],
        previousValue: 'old',
        expiresAt: null,
        subFeature: 'Contract.tags',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        output: {
          entity: 'Contract',
          entityId: 'c1',
          field: 'tags',
          proposedValue: ['new'],
          agentId: 'agent-a',
        },
      },
    ]);
    mocks.mockAgentGoalFindMany.mockResolvedValue([
      {
        id: 'goal-1',
        title: 'Review renewal',
        description: 'Please approve',
        priority: 2,
        contractId: 'c2',
        type: 'RENEWAL_MANAGEMENT',
        plan: {},
        createdAt: new Date('2026-08-02T00:00:00Z'),
      },
    ]);

    const res = await GET(authReq('http://localhost/api/inbox'));
    expect(res.status).toBe(200);
    const json = await res.json();
    const data = json.data ?? json;
    expect(data.items.length).toBe(2);
    expect(data.stats.total).toBe(2);
    // critical/high risk first (goal priority 2 = critical, write conf 0.4 = high)
    expect(data.items[0].type).toBe('agent_goal');
    expect(data.items.some((i: { type: string }) => i.type === 'agent_write')).toBe(true);
  });
});
