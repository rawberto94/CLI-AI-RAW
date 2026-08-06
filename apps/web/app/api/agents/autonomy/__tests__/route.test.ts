/**
 * Autonomy settings API + graduation accept path
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentAutonomyConfig: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

vi.mock('@/lib/analytics/ux-events', () => ({
  emitUxEvent: vi.fn().mockResolvedValue(undefined),
}));

import { GET, PUT } from '../route';

function authReq(url: string, body?: Record<string, unknown>) {
  const headers: Record<string, string> = {
    'x-user-id': 'user-1',
    'x-tenant-id': 'tenant-1',
  };
  const opts: RequestInit = { method: body ? 'PUT' : 'GET', headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return new NextRequest(url, opts);
}

describe('GET/PUT /api/agents/autonomy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns configs with review defaults', async () => {
    mocks.findMany.mockResolvedValue([]);
    const res = await GET(authReq('http://localhost/api/agents/autonomy'));
    expect(res.status).toBe(200);
    const json = await res.json();
    const data = json.data ?? json;
    expect(data.defaults.mode).toBe('review');
    expect(data.configs).toEqual([]);
  });

  it('upserts auto mode for an agent', async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({
      id: 'cfg-1',
      tenantId: 'tenant-1',
      agentId: 'agent-a',
      actionType: 'agent_write',
      mode: 'auto',
      confidenceThreshold: 0.9,
      riskThreshold: 'medium',
      costThreshold: null,
    });

    const res = await PUT(
      authReq('http://localhost/api/agents/autonomy', {
        agentId: 'agent-a',
        actionType: 'agent_write',
        mode: 'auto',
        confidenceThreshold: 0.9,
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalled();
    const json = await res.json();
    expect((json.data ?? json).config.mode).toBe('auto');
  });
});
