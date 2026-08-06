import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentGoal: { findFirst: mocks.findFirst },
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

import { GET } from '../route';

function authReq(runId: string) {
  return new NextRequest(`http://localhost/api/agents/runs/${runId}`, {
    method: 'GET',
    headers: { 'x-user-id': 'u1', 'x-tenant-id': 't1' },
  });
}

describe('GET /api/agents/runs/[runId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps goal steps into run inspector shape', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 'goal-1',
      title: 'Review risk',
      description: 'desc',
      status: 'COMPLETED',
      type: 'RISK',
      contractId: 'c1',
      progress: 100,
      error: null,
      plan: null,
      context: {},
      result: { summary: 'All good' },
      createdAt: new Date('2026-08-01'),
      startedAt: new Date('2026-08-01'),
      completedAt: new Date('2026-08-01'),
      steps: [
        {
          id: 's1',
          name: 'Scan clauses',
          type: 'tool_call',
          order: 1,
          status: 'COMPLETED',
          duration: 120,
          input: { toolId: 'scanner' },
          output: { confidence: 0.9, tokens: 10 },
          error: null,
          startedAt: new Date('2026-08-01'),
          completedAt: new Date('2026-08-01'),
          createdAt: new Date('2026-08-01'),
        },
      ],
    });

    const res = await GET(authReq('goal-1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    const run = (json.data ?? json).run;
    expect(run.id).toBe('goal-1');
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0].type).toBe('tool_call');
    expect(run.summary).toBe('All good');
  });

  it('returns 404 when missing', async () => {
    mocks.findFirst.mockResolvedValue(null);
    const res = await GET(authReq('missing'));
    expect(res.status).toBe(404);
  });
});
