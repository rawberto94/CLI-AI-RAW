/**
 * Tests for GET/POST /api/agents/observability
 * Agent traces, metrics, and real-time observability data
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockAgentGoalFindMany: vi.fn(),
  mockAgentGoalCount: vi.fn(),
  mockAgentGoalGroupBy: vi.fn(),
  mockAgentGoalCreate: vi.fn(),
  mockAgentGoalUpdate: vi.fn(),
  mockAgentGoalStepCount: vi.fn(),
  mockAgentGoalStepCreate: vi.fn(),
  mockGetCached: vi.fn(),
  mockSetCached: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentGoal: {
      findMany: mocks.mockAgentGoalFindMany,
      count: mocks.mockAgentGoalCount,
      groupBy: mocks.mockAgentGoalGroupBy,
      create: mocks.mockAgentGoalCreate,
      update: mocks.mockAgentGoalUpdate,
    },
    agentGoalStep: {
      count: mocks.mockAgentGoalStepCount,
      create: mocks.mockAgentGoalStepCreate,
    },
  },
}));

vi.mock('@/lib/cache', () => ({
  getCached: mocks.mockGetCached,
  setCached: mocks.mockSetCached,
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

// ── Import routes AFTER mocks ─────────────────────────────────────────

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

function noAuthReq(url: string, method: 'GET' | 'POST' = 'GET') {
  if (method === 'POST') {
    return new NextRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_trace' }),
    });
  }
  return new NextRequest(url, { method: 'GET' });
}

const BASE = 'http://localhost:3000/api/agents/observability';

// ── GET Tests ──────────────────────────────────────────────────────────

describe('GET /api/agents/observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply resolved values for mocks after reset
    mocks.mockGetCached.mockResolvedValue(null);
    mocks.mockSetCached.mockResolvedValue(undefined);
    mocks.mockAgentGoalFindMany.mockResolvedValue([]);
    mocks.mockAgentGoalCount.mockResolvedValue(0);
    mocks.mockAgentGoalGroupBy.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE));
    expect(res.status).toBe(401);
  });

  it('returns traces and metrics (type=all)', async () => {
    const dbGoals = [
      {
        id: 'g1',
        type: 'extraction',
        title: 'Extract NDA',
        description: 'Extract NDA fields',
        status: 'COMPLETED',
        createdAt: new Date('2024-01-01'),
        startedAt: new Date('2024-01-01T00:01:00'),
        completedAt: new Date('2024-01-01T00:05:00'),
        updatedAt: new Date('2024-01-01T00:05:00'),
        result: {},
        steps: [],
      },
    ];
    mocks.mockAgentGoalFindMany.mockResolvedValue(dbGoals);
    mocks.mockAgentGoalCount.mockResolvedValue(1);
    mocks.mockAgentGoalGroupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: 1 },
    ]);

    const res = await GET(authReq(`${BASE}?type=all`));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.traces).toBeDefined();
    expect(json.data.metrics).toBeDefined();
    expect(json.data.timestamp).toBeDefined();
    expect(json.data.traces).toHaveLength(1);
    expect(json.data.traces[0].id).toBe('g1');
    expect(json.data.traces[0].status).toBe('completed');
  });

  it('returns only traces (type=traces)', async () => {
    mocks.mockAgentGoalFindMany.mockResolvedValue([]);

    const res = await GET(authReq(`${BASE}?type=traces`));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.traces).toBeDefined();
    expect(json.data.metrics).toBeUndefined();
  });

  it('returns only metrics (type=metrics)', async () => {
    mocks.mockAgentGoalCount.mockResolvedValue(10);
    mocks.mockAgentGoalGroupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: 7 },
      { status: 'FAILED', _count: 3 },
    ]);
    // recentGoals query for avg completion time
    mocks.mockAgentGoalFindMany.mockResolvedValue([]);

    const res = await GET(authReq(`${BASE}?type=metrics`));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.metrics).toBeDefined();
    expect(json.data.traces).toBeUndefined();
  });
});

// ── POST Tests ─────────────────────────────────────────────────────────

describe('POST /api/agents/observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAgentGoalCreate.mockResolvedValue({ id: 'trace-1' });
    mocks.mockAgentGoalStepCount.mockResolvedValue(0);
    mocks.mockAgentGoalStepCreate.mockResolvedValue({ id: 'step-1' });
    mocks.mockAgentGoalUpdate.mockResolvedValue({});
  });

  it('returns 401 without auth', async () => {
    const res = await POST(noAuthReq(BASE, 'POST'));
    expect(res.status).toBe(401);
  });

  it('create_trace creates a goal and returns traceId', async () => {
    mocks.mockAgentGoalCreate.mockResolvedValue({ id: 'new-trace-id' });

    const res = await POST(authReq(BASE, {
      action: 'create_trace',
      trace: {
        agentName: 'extraction-agent',
        agentType: 'extraction',
        goal: 'Extract NDA fields',
        sessionId: 'sess-1',
        contractId: 'c1',
      },
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.traceId).toBe('new-trace-id');
    expect(json.data.message).toContain('Trace created');
  });

  it('add_step requires traceId and step', async () => {
    const res1 = await POST(authReq(BASE, {
      action: 'add_step',
      // missing traceId and step
    }));
    expect(res1.status).toBe(400);

    const res2 = await POST(authReq(BASE, {
      action: 'add_step',
      traceId: 'trace-1',
      // missing step
    }));
    expect(res2.status).toBe(400);
  });

  it('unknown action returns 400', async () => {
    const res = await POST(authReq(BASE, {
      action: 'delete_trace',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain('Unknown action');
  });
});
