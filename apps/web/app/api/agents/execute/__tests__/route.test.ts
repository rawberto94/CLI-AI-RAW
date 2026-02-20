/**
 * Tests for POST /api/agents/execute
 * Manual agent execution endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockRegistryGet: vi.fn(),
  mockExecuteWithTracking: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@repo/workers/agents', () => ({
  agentRegistry: {
    get: mocks.mockRegistryGet,
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

// ── Import route AFTER mocks ──────────────────────────────────────────

import { POST } from '../route';

// ── Helpers ────────────────────────────────────────────────────────────

function authReq(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function noAuthReq(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE = 'http://localhost:3000/api/agents/execute';

// ── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/agents/execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    const res = await POST(noAuthReq(BASE, { agentName: 'test', contractId: 'c1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing agentName or contractId', async () => {
    const res1 = await POST(authReq(BASE, { contractId: 'c1' }));
    expect(res1.status).toBe(400);

    const res2 = await POST(authReq(BASE, { agentName: 'test' }));
    expect(res2.status).toBe(400);
  });

  it('returns 404 when agent not found in registry', async () => {
    mocks.mockRegistryGet.mockReturnValue(undefined);

    const res = await POST(authReq(BASE, { agentName: 'nonexistent', contractId: 'c1' }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toContain('nonexistent');
  });

  it('returns successful execution with agent name and result', async () => {
    const mockResult = {
      success: true,
      data: { overallScore: 95 },
      reasoning: 'All good',
    };
    mocks.mockRegistryGet.mockReturnValue({
      executeWithTracking: mocks.mockExecuteWithTracking,
    });
    mocks.mockExecuteWithTracking.mockResolvedValue(mockResult);

    const res = await POST(authReq(BASE, {
      agentName: 'contract-health-monitor',
      contractId: 'c1',
      context: { extra: true },
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.agent).toBe('contract-health-monitor');
    expect(json.data.result).toEqual(mockResult);
  });

  it('uses ctx.tenantId not body.tenantId (security)', async () => {
    mocks.mockRegistryGet.mockReturnValue({
      executeWithTracking: mocks.mockExecuteWithTracking,
    });
    mocks.mockExecuteWithTracking.mockResolvedValue({ success: true });

    await POST(authReq(BASE, {
      agentName: 'test-agent',
      contractId: 'c1',
      tenantId: 'EVIL-TENANT',
    }));

    expect(mocks.mockExecuteWithTracking).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1', // from auth header, NOT "EVIL-TENANT"
      }),
    );
  });
});
