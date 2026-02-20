/**
 * Tests for GET /api/agents/opportunities
 * Discovered opportunities for a tenant
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockContractFindUnique: vi.fn(),
  mockAgentEventFindMany: vi.fn(),
  mockExecuteWithTracking: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findUnique: mocks.mockContractFindUnique,
    },
    agentEvent: {
      findMany: mocks.mockAgentEventFindMany,
    },
  },
}));

vi.mock('@repo/workers/agents', () => ({
  opportunityDiscoveryEngine: {
    executeWithTracking: mocks.mockExecuteWithTracking,
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

const BASE = 'http://localhost:3000/api/agents/opportunities';

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/agents/opportunities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockContractFindUnique.mockResolvedValue(null);
    mocks.mockAgentEventFindMany.mockResolvedValue([]);
    mocks.mockExecuteWithTracking.mockResolvedValue({ success: true, data: { opportunities: [] } });
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE));
    expect(res.status).toBe(401);
  });

  it('returns 404 when contractId provided but contract not found', async () => {
    mocks.mockContractFindUnique.mockResolvedValue(null);

    const res = await GET(authReq(`${BASE}?contractId=missing-id`));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toContain('not found');
  });

  it('returns opportunities for specific contract (discovery engine path)', async () => {
    mocks.mockContractFindUnique.mockResolvedValue({
      id: 'c1',
      contractTitle: 'Service Agreement',
      artifacts: [{ id: 'a1' }],
    });
    mocks.mockExecuteWithTracking.mockResolvedValue({
      success: true,
      data: {
        opportunities: [
          { type: 'cost_savings', potentialValue: 50000, description: 'Renegotiate terms' },
          { type: 'risk_mitigation', potentialValue: 20000, description: 'Add SLA clause' },
        ],
      },
    });

    const res = await GET(authReq(`${BASE}?contractId=c1`));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.opportunities).toHaveLength(2);
    expect(json.data.totalValue).toBe(70000);
  });

  it('returns tenant opportunities from events (no contractId)', async () => {
    mocks.mockAgentEventFindMany.mockResolvedValue([
      {
        contractId: 'c1',
        timestamp: new Date('2024-06-01'),
        metadata: {
          opportunities: [
            { type: 'cost_savings', potentialValue: 30000, description: 'Bundle discount' },
          ],
        },
      },
      {
        contractId: 'c2',
        timestamp: new Date('2024-06-02'),
        metadata: {
          opportunities: [
            { type: 'revenue', potentialValue: 15000, description: 'Upsell opportunity' },
          ],
        },
      },
    ]);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.opportunities).toHaveLength(2);
    expect(json.data.totalValue).toBe(45000);
    expect(json.data.count).toBe(2);
  });

  it('filters by minValue', async () => {
    mocks.mockAgentEventFindMany.mockResolvedValue([
      {
        contractId: 'c1',
        timestamp: new Date('2024-06-01'),
        metadata: {
          opportunities: [
            { type: 'cost_savings', potentialValue: 5000 },
            { type: 'revenue', potentialValue: 50000 },
          ],
        },
      },
    ]);

    const res = await GET(authReq(`${BASE}?minValue=10000`));
    expect(res.status).toBe(200);
    const json = await res.json();

    // Only the 50000 opportunity should pass the filter
    expect(json.data.opportunities).toHaveLength(1);
    expect(json.data.opportunities[0].potentialValue).toBe(50000);
  });
});
