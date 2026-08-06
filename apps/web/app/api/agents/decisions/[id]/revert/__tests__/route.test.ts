/**
 * Tests for POST /api/agents/decisions/[id]/revert
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockContractUpdateMany: vi.fn(),
  mockAuditCreate: vi.fn(),
  mockAnalyticsCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiDecision: {
      findFirst: mocks.mockFindFirst,
      updateMany: mocks.mockUpdateMany,
      update: mocks.mockUpdate,
    },
    contract: { updateMany: mocks.mockContractUpdateMany, findMany: vi.fn() },
    contractMetadata: { updateMany: vi.fn(), findMany: vi.fn() },
    obligation: { updateMany: vi.fn(), findMany: vi.fn() },
    auditLog: { create: mocks.mockAuditCreate },
    analyticsEvent: { create: mocks.mockAnalyticsCreate },
  },
}));

vi.mock('data-orchestration/services', () => ({
  monitoringService: { recordMetric: vi.fn() },
}));

vi.mock('@/lib/analytics/ux-events', () => ({
  emitUxEvent: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '../route';

function authReq(id: string) {
  return new NextRequest(`http://localhost:3000/api/agents/decisions/${id}/revert`, {
    method: 'POST',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
    },
  });
}

describe('POST /api/agents/decisions/[id]/revert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAuditCreate.mockResolvedValue({ id: 'audit-1' });
    mocks.mockContractUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('returns 401 without auth', async () => {
    const res = await POST(
      new NextRequest('http://localhost:3000/api/agents/decisions/dec-1/revert', {
        method: 'POST',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('reverts an accepted decision with previousValue', async () => {
    mocks.mockFindFirst.mockResolvedValue({
      id: 'dec-1',
      tenantId: 'tenant-1',
      contractId: 'c1',
      feature: 'agent_write',
      outcome: 'accepted',
      previousValue: ['old'],
      revertedAt: null,
      subFeature: 'Contract.tags',
      userFeedback: null,
      output: {
        entity: 'Contract',
        entityId: 'c1',
        field: 'tags',
        proposedValue: ['new'],
        agentId: 'agent-a',
      },
    });
    mocks.mockUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST(authReq('dec-1'));
    expect(res.status).toBe(200);
    expect(mocks.mockContractUpdateMany).toHaveBeenCalledWith({
      where: { id: 'c1', tenantId: 'tenant-1' },
      data: { tags: ['old'] },
    });
    expect(mocks.mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'dec-1' }),
        data: expect.objectContaining({ outcome: 'reverted' }),
      }),
    );
    expect(mocks.mockAuditCreate).toHaveBeenCalled();
  });

  it('returns 409 when previousValue is missing', async () => {
    mocks.mockFindFirst.mockResolvedValue({
      id: 'dec-2',
      tenantId: 'tenant-1',
      contractId: 'c1',
      feature: 'agent_write',
      outcome: 'accepted',
      previousValue: null,
      revertedAt: null,
      output: {
        entity: 'Contract',
        entityId: 'c1',
        field: 'tags',
        proposedValue: ['new'],
      },
    });

    const res = await POST(authReq('dec-2'));
    expect(res.status).toBe(409);
    expect(mocks.mockContractUpdateMany).not.toHaveBeenCalled();
  });

  it('returns 400 when decision is still pending', async () => {
    mocks.mockFindFirst.mockResolvedValue({
      id: 'dec-3',
      tenantId: 'tenant-1',
      feature: 'agent_write',
      outcome: 'pending',
      previousValue: ['x'],
      revertedAt: null,
      output: { entity: 'Contract', entityId: 'c1', field: 'tags' },
    });

    const res = await POST(authReq('dec-3'));
    expect(res.status).toBe(400);
  });
});
