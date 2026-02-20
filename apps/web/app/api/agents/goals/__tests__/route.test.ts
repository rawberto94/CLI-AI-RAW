/**
 * Tests for GET/POST /api/agents/goals
 * Agent Goals API — Human-in-the-Loop Approval System
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockAgentGoalFindMany: vi.fn(),
  mockAgentGoalCount: vi.fn(),
  mockAgentGoalFindFirst: vi.fn(),
  mockAgentGoalUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockBroadcastSSE: vi.fn(),
  mockSendHITLDecision: vi.fn(),
  mockQueueAddJob: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentGoal: {
      findMany: mocks.mockAgentGoalFindMany,
      count: mocks.mockAgentGoalCount,
      findFirst: mocks.mockAgentGoalFindFirst,
      update: mocks.mockAgentGoalUpdate,
    },
    auditLog: {
      create: mocks.mockAuditLogCreate,
    },
  },
}));

vi.mock('@prisma/client', () => ({
  AgentGoalStatus: {
    AWAITING_APPROVAL: 'AWAITING_APPROVAL',
    EXECUTING: 'EXECUTING',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED',
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

vi.mock('@/app/api/agents/sse/route', () => ({
  broadcastSSE: mocks.mockBroadcastSSE,
}));

vi.mock('@/lib/notifications/hitl-notification.service', () => ({
  sendHITLApprovalNotification: vi.fn().mockResolvedValue(undefined),
  sendHITLDecisionNotification: mocks.mockSendHITLDecision.mockResolvedValue(undefined),
}));

vi.mock('@/lib/queue-init', () => ({
  getInitializedQueueService: () => ({
    addJob: mocks.mockQueueAddJob.mockResolvedValue(undefined),
  }),
}));

// ── Import routes AFTER mocks ──────────────────────────────────────────

import { GET, POST } from '../route';

// ── Helpers ────────────────────────────────────────────────────────────

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

const BASE = 'http://localhost:3000/api/agents/goals';

// ── GET Tests ──────────────────────────────────────────────────────────

describe('GET /api/agents/goals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE));
    expect(res.status).toBe(401);
  });

  it('returns goals list', async () => {
    const goals = [
      { id: 'g1', title: 'Review risk', status: 'AWAITING_APPROVAL', steps: [], triggers: [] },
      { id: 'g2', title: 'Check compliance', status: 'EXECUTING', steps: [], triggers: [] },
    ];
    mocks.mockAgentGoalFindMany.mockResolvedValue(goals);
    mocks.mockAgentGoalCount.mockResolvedValue(2);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.goals).toHaveLength(2);
    expect(json.data.total).toBe(2);
    expect(json.data.hasMore).toBe(false);
  });

  it('filters by awaiting status', async () => {
    mocks.mockAgentGoalFindMany.mockResolvedValue([]);
    mocks.mockAgentGoalCount.mockResolvedValue(0);

    const res = await GET(authReq(`${BASE}?status=awaiting`));
    expect(res.status).toBe(200);
    expect(mocks.mockAgentGoalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'AWAITING_APPROVAL' }),
      }),
    );
  });

  it('respects limit and offset', async () => {
    mocks.mockAgentGoalFindMany.mockResolvedValue([]);
    mocks.mockAgentGoalCount.mockResolvedValue(100);

    const res = await GET(authReq(`${BASE}?limit=10&offset=20`));
    expect(res.status).toBe(200);
    expect(mocks.mockAgentGoalFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 }),
    );
    const json = await res.json();
    expect(json.data.hasMore).toBe(true);
  });
});

// ── POST Tests ─────────────────────────────────────────────────────────

describe('POST /api/agents/goals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply resolved value after clearAllMocks — the route calls .catch() on the return
    mocks.mockSendHITLDecision.mockResolvedValue(undefined);
    mocks.mockQueueAddJob.mockResolvedValue(undefined);
  });

  it('returns 401 without auth', async () => {
    const res = await POST(
      new NextRequest(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: 'g1', action: 'approve' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing goalId or action', async () => {
    const res = await POST(authReq(BASE, { goalId: 'g1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action', async () => {
    const res = await POST(authReq(BASE, { goalId: 'g1', action: 'delete' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when goal not found', async () => {
    mocks.mockAgentGoalFindFirst.mockResolvedValue(null);
    const res = await POST(authReq(BASE, { goalId: 'g1', action: 'approve' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when goal not awaiting approval', async () => {
    mocks.mockAgentGoalFindFirst.mockResolvedValue({
      id: 'g1', title: 'Test', status: 'EXECUTING', tenantId: 'tenant-1',
    });
    const res = await POST(authReq(BASE, { goalId: 'g1', action: 'approve' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('not awaiting approval');
  });

  it('approves a goal and queues execution', async () => {
    mocks.mockAgentGoalFindFirst.mockResolvedValue({
      id: 'g1', title: 'Risk review', status: 'AWAITING_APPROVAL', tenantId: 'tenant-1',
    });
    mocks.mockAgentGoalUpdate.mockResolvedValue({
      id: 'g1', status: 'EXECUTING', approvedBy: 'user-1',
    });
    mocks.mockAuditLogCreate.mockResolvedValue({});

    const res = await POST(authReq(BASE, { goalId: 'g1', action: 'approve' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.goal.status).toBe('EXECUTING');
    expect(json.data.message).toBe('Goal approved successfully');

    // Verify side effects
    expect(mocks.mockAgentGoalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'g1' },
        data: expect.objectContaining({ status: 'EXECUTING', approvedBy: 'user-1' }),
      }),
    );
    expect(mocks.mockQueueAddJob).toHaveBeenCalledWith(
      'agent-orchestration', 'execute-goal',
      { goalId: 'g1', tenantId: 'tenant-1' },
      expect.any(Object),
    );
    expect(mocks.mockBroadcastSSE).toHaveBeenCalledWith('tenant-1', 'goal_approved', expect.any(Object));
    expect(mocks.mockAuditLogCreate).toHaveBeenCalled();
  });

  it('rejects a goal with feedback', async () => {
    mocks.mockAgentGoalFindFirst.mockResolvedValue({
      id: 'g1', title: 'Risky action', status: 'AWAITING_APPROVAL', tenantId: 'tenant-1',
    });
    mocks.mockAgentGoalUpdate.mockResolvedValue({
      id: 'g1', status: 'CANCELLED', error: 'Too risky',
    });
    mocks.mockAuditLogCreate.mockResolvedValue({});

    const res = await POST(authReq(BASE, { goalId: 'g1', action: 'reject', feedback: 'Too risky' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.goal.status).toBe('CANCELLED');

    expect(mocks.mockAgentGoalUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED', error: 'Too risky' }),
      }),
    );
    expect(mocks.mockBroadcastSSE).toHaveBeenCalledWith('tenant-1', 'goal_rejectd', expect.any(Object));
  });

  it('modifies a goal with feedback', async () => {
    mocks.mockAgentGoalFindFirst.mockResolvedValue({
      id: 'g1', title: 'Partial plan', status: 'AWAITING_APPROVAL', tenantId: 'tenant-1',
    });
    mocks.mockAgentGoalUpdate.mockResolvedValue({
      id: 'g1', status: 'AWAITING_APPROVAL', error: 'Adjust scope',
    });
    mocks.mockAuditLogCreate.mockResolvedValue({});

    const res = await POST(authReq(BASE, { goalId: 'g1', action: 'modify', feedback: 'Adjust scope' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.goal.status).toBe('AWAITING_APPROVAL');
  });
});
