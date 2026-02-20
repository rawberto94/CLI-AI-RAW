/**
 * Tests for GET/POST/PATCH /api/agents/orchestrator
 * Autonomous Agent Orchestrator API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
  mockGetGoals: vi.fn(),
  mockGetGoal: vi.fn(),
  mockGetTriggers: vi.fn(),
  mockGetNotifications: vi.fn(),
  mockCreateGoal: vi.fn(),
  mockCancelGoal: vi.fn(),
  mockRegisterTrigger: vi.fn(),
  mockSetTriggerEnabled: vi.fn(),
  mockMarkNotificationRead: vi.fn(),
  mockStartProcessing: vi.fn(),
  mockStopProcessing: vi.fn(),
  mockOn: vi.fn(),
  mockBroadcastSSE: vi.fn(),
  mockSendHITLApprovalNotification: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@repo/agents', () => ({
  getAutonomousOrchestrator: () => ({
    getStatus: mocks.mockGetStatus,
    getGoals: mocks.mockGetGoals,
    getGoal: mocks.mockGetGoal,
    getTriggers: mocks.mockGetTriggers,
    getNotifications: mocks.mockGetNotifications,
    createGoal: mocks.mockCreateGoal,
    cancelGoal: mocks.mockCancelGoal,
    registerTrigger: mocks.mockRegisterTrigger,
    setTriggerEnabled: mocks.mockSetTriggerEnabled,
    markNotificationRead: mocks.mockMarkNotificationRead,
    startProcessing: mocks.mockStartProcessing,
    stopProcessing: mocks.mockStopProcessing,
    on: mocks.mockOn,
  }),
  AgentGoalStatus: {},
}));

vi.mock('@/app/api/agents/sse/route', () => ({
  broadcastSSE: mocks.mockBroadcastSSE,
}));

vi.mock('@/lib/notifications/hitl-notification.service', () => ({
  sendHITLApprovalNotification: mocks.mockSendHITLApprovalNotification.mockResolvedValue(undefined),
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

// ── Import routes AFTER mocks ─────────────────────────────────────────

import { GET, POST, PATCH } from '../route';

// ── Helpers ────────────────────────────────────────────────────────────

function authReq(url: string, body?: Record<string, unknown>) {
  const headers: Record<string, string> = {
    'x-user-id': 'user-1',
    'x-tenant-id': 'tenant-1',
  };
  const method = body ? 'POST' : 'GET';
  const opts: RequestInit = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return new NextRequest(url, opts);
}

function patchReq(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function noAuthReq(url: string, method: 'GET' | 'POST' = 'GET') {
  if (method === 'POST') {
    return new NextRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_goal', type: 'review', description: 'test' }),
    });
  }
  return new NextRequest(url, { method: 'GET' });
}

const BASE = 'http://localhost:3000/api/agents/orchestrator';

// ── GET Tests ──────────────────────────────────────────────────────────

describe('GET /api/agents/orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetStatus.mockReturnValue({ isRunning: true, queueSize: 3 });
    mocks.mockGetGoals.mockReturnValue({ goals: [], total: 0 });
    mocks.mockGetGoal.mockReturnValue(null);
    mocks.mockGetTriggers.mockReturnValue([]);
    mocks.mockGetNotifications.mockReturnValue([]);
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE));
    expect(res.status).toBe(401);
  });

  it('returns orchestrator status (resource=status)', async () => {
    mocks.mockGetStatus.mockReturnValue({ isRunning: true, queueSize: 5, activeGoal: null });

    const res = await GET(authReq(`${BASE}?resource=status`));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.isRunning).toBe(true);
    expect(json.data.queueSize).toBe(5);
  });

  it('returns goals (resource=goals)', async () => {
    mocks.mockGetGoals.mockReturnValue({
      goals: [{ id: 'g1', type: 'review', status: 'pending' }],
      total: 1,
    });

    const res = await GET(authReq(`${BASE}?resource=goals`));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.goals).toHaveLength(1);
    expect(json.data.goals[0].id).toBe('g1');
  });

  it('returns 404 when goal not found (resource=goal)', async () => {
    mocks.mockGetGoal.mockReturnValue(null);

    const res = await GET(authReq(`${BASE}?resource=goal&id=nonexistent`));
    expect(res.status).toBe(404);
  });
});

// ── POST Tests ─────────────────────────────────────────────────────────

describe('POST /api/agents/orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCreateGoal.mockResolvedValue({ id: 'g-new', type: 'review', status: 'pending' });
    mocks.mockCancelGoal.mockResolvedValue(true);
  });

  it('returns 401 without auth', async () => {
    const res = await POST(noAuthReq(BASE, 'POST'));
    expect(res.status).toBe(401);
  });

  it('create_goal requires type and description', async () => {
    const res1 = await POST(authReq(BASE, { action: 'create_goal', type: 'review' }));
    expect(res1.status).toBe(400);

    const res2 = await POST(authReq(BASE, { action: 'create_goal', description: 'test' }));
    expect(res2.status).toBe(400);
  });

  it('create_goal returns created goal', async () => {
    mocks.mockCreateGoal.mockResolvedValue({
      id: 'g-new',
      type: 'risk_review',
      status: 'pending',
      description: 'Review NDA risks',
    });

    const res = await POST(authReq(BASE, {
      action: 'create_goal',
      type: 'risk_review',
      description: 'Review NDA risks',
      priority: 'high',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe('g-new');
    expect(json.data.message).toContain('Goal created');
  });

  it('cancel_goal returns result', async () => {
    mocks.mockCancelGoal.mockResolvedValue(true);

    const res = await POST(authReq(BASE, {
      action: 'cancel_goal',
      goalId: 'g1',
      reason: 'No longer needed',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cancelled).toBe(true);
  });
});

// ── PATCH Tests ────────────────────────────────────────────────────────

describe('PATCH /api/agents/orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetGoal.mockReturnValue({
      id: 'g1',
      type: 'review',
      status: 'pending',
      description: 'Original',
      priority: 'medium',
      metadata: {},
      updatedAt: new Date(),
    });
    mocks.mockSetTriggerEnabled.mockReturnValue(true);
    mocks.mockGetTriggers.mockReturnValue([{ id: 't1', enabled: true }]);
  });

  it('updates a goal', async () => {
    const res = await PATCH(patchReq(BASE, {
      resource: 'goal',
      id: 'g1',
      updates: { description: 'Updated description', priority: 'high' },
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.message).toContain('updated successfully');
  });
});
