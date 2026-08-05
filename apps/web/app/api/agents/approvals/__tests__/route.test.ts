/**
 * Tests for GET/POST /api/agents/approvals
 * Covers agent_write pending proposals + tenant-scoped approve/reject.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockAiDecisionFindMany: vi.fn(),
  mockAiDecisionFindFirst: vi.fn(),
  mockAiDecisionUpdate: vi.fn(),
  mockAgentGoalFindMany: vi.fn(),
  mockRfxFindMany: vi.fn(),
  mockRiskFindMany: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockContractUpdateMany: vi.fn(),
  mockContractMetadataUpdateMany: vi.fn(),
  mockObligationUpdateMany: vi.fn(),
  mockApprovalActionCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiDecision: {
      findMany: mocks.mockAiDecisionFindMany,
      findFirst: mocks.mockAiDecisionFindFirst,
      update: mocks.mockAiDecisionUpdate,
    },
    agentGoal: { findMany: mocks.mockAgentGoalFindMany },
    rFxEvent: { findMany: mocks.mockRfxFindMany },
    riskDetectionLog: { findMany: mocks.mockRiskFindMany },
    contract: {
      findMany: mocks.mockContractFindMany,
      updateMany: mocks.mockContractUpdateMany,
    },
    contractMetadata: { updateMany: mocks.mockContractMetadataUpdateMany },
    obligation: { updateMany: mocks.mockObligationUpdateMany },
    approvalAction: { create: mocks.mockApprovalActionCreate },
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

import { GET, POST } from '../route';

function authReq(url: string, body?: Record<string, unknown>) {
  const headers: Record<string, string> = {
    'x-user-id': 'user-1',
    'x-tenant-id': 'tenant-1',
  };
  const opts: RequestInit = { method: body ? 'POST' : 'GET', headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return new NextRequest(url, opts);
}

function noAuthReq(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

const BASE = 'http://localhost:3000/api/agents/approvals';

describe('GET /api/agents/approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAgentGoalFindMany.mockResolvedValue([]);
    mocks.mockRfxFindMany.mockResolvedValue([]);
    mocks.mockRiskFindMany.mockResolvedValue([]);
    mocks.mockContractFindMany.mockResolvedValue([]);
    mocks.mockAiDecisionFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE));
    expect(res.status).toBe(401);
  });

  it('includes pending agent_write decisions', async () => {
    mocks.mockAiDecisionFindMany.mockResolvedValue([
      {
        id: 'dec-1',
        tenantId: 'tenant-1',
        contractId: 'c1',
        feature: 'agent_write',
        outcome: 'pending',
        outputType: 'agent_field_write',
        model: 'test-agent',
        confidence: 0.6,
        citations: [],
        evidenceChain: [],
        subFeature: 'Contract.tags',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        output: {
          entity: 'Contract',
          entityId: 'c1',
          field: 'tags',
          proposedValue: ['needs-review'],
          agentId: 'test-agent',
          confidence: 0.6,
        },
      },
    ]);

    const res = await GET(authReq(`${BASE}?type=agent_write`));
    expect(res.status).toBe(200);
    const json = await res.json();
    const approvals = json.data?.approvals ?? json.approvals;
    expect(approvals).toHaveLength(1);
    expect(approvals[0].type).toBe('agent_write');
    expect(approvals[0].id).toBe('agent-write-dec-1');
    expect(approvals[0].context.field).toBe('tags');
  });
});

describe('POST /api/agents/approvals agent_write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockApprovalActionCreate.mockResolvedValue({ id: 'aa-1' });
  });

  it('approves a pending field write with tenant-scoped update', async () => {
    mocks.mockAiDecisionFindFirst.mockResolvedValue({
      id: 'dec-1',
      tenantId: 'tenant-1',
      contractId: 'c1',
      feature: 'agent_write',
      outcome: 'pending',
      output: {
        entity: 'Contract',
        entityId: 'c1',
        field: 'tags',
        proposedValue: ['ok'],
      },
    });
    mocks.mockContractUpdateMany.mockResolvedValue({ count: 1 });
    mocks.mockAiDecisionUpdate.mockResolvedValue({});

    const res = await POST(
      authReq(BASE, { actionId: 'agent-write-dec-1', action: 'approve' }),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockContractUpdateMany).toHaveBeenCalledWith({
      where: { id: 'c1', tenantId: 'tenant-1' },
      data: { tags: ['ok'] },
    });
    expect(mocks.mockAiDecisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dec-1' },
        data: expect.objectContaining({ outcome: 'accepted' }),
      }),
    );
  });

  it('rejects denylisted field even if pending row exists', async () => {
    mocks.mockAiDecisionFindFirst.mockResolvedValue({
      id: 'dec-2',
      tenantId: 'tenant-1',
      contractId: 'c1',
      feature: 'agent_write',
      outcome: 'pending',
      output: {
        entity: 'Contract',
        entityId: 'c1',
        field: 'totalValue',
        proposedValue: 999999,
      },
    });

    const res = await POST(
      authReq(BASE, { actionId: 'agent-write-dec-2', action: 'approve' }),
    );
    // withAuthApiHandler wraps errors as 500 INTERNAL_ERROR typically
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(mocks.mockContractUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects a pending write without applying', async () => {
    mocks.mockAiDecisionFindFirst.mockResolvedValue({
      id: 'dec-3',
      tenantId: 'tenant-1',
      contractId: 'c1',
      feature: 'agent_write',
      outcome: 'pending',
      output: {
        entity: 'Contract',
        entityId: 'c1',
        field: 'tags',
        proposedValue: ['x'],
      },
    });
    mocks.mockAiDecisionUpdate.mockResolvedValue({});

    const res = await POST(
      authReq(BASE, {
        actionId: 'agent-write-dec-3',
        action: 'reject',
        notes: 'nope',
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockContractUpdateMany).not.toHaveBeenCalled();
    expect(mocks.mockAiDecisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: 'rejected' }),
      }),
    );
  });
});
