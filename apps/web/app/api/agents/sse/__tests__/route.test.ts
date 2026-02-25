/**
 * Tests for GET /api/agents/sse and broadcast helpers
 * Agent Server-Sent Events endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockAgentEventFindMany: vi.fn().mockResolvedValue([]),
  mockAgentGoalCount: vi.fn().mockResolvedValue(0),
  mockRFxOpportunityCount: vi.fn().mockResolvedValue(0),
  mockRedisPublish: vi.fn().mockResolvedValue(undefined),
  mockRedisDuplicate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentEvent: { findMany: mocks.mockAgentEventFindMany },
    agentGoal: { count: mocks.mockAgentGoalCount },
    rFxOpportunity: { count: mocks.mockRFxOpportunityCount },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    publish: mocks.mockRedisPublish,
    duplicate: mocks.mockRedisDuplicate.mockReturnValue({
      connect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('@/lib/notifications/hitl-notification.service', () => ({
  sendHITLApprovalNotification: vi.fn().mockResolvedValue(undefined),
}));

// ── Import AFTER mocks ────────────────────────────────────────────────

import { GET, broadcastActivity, broadcastApproval, broadcastOpportunity } from '../route';

// ── Helpers ────────────────────────────────────────────────────────────

function reqWithTenant() {
  const controller = new AbortController();
  const req = new NextRequest('http://localhost:3000/api/agents/sse?tenantId=tenant-1&userId=user-1', {
    method: 'GET',
  });
  // Ensure signal is present for SSE stream cleanup handler
  if (!req.signal) {
    Object.defineProperty(req, 'signal', {
      value: controller.signal,
      writable: false,
    });
  }
  return req;
}

function reqWithoutTenant() {
  return new NextRequest('http://localhost:3000/api/agents/sse', {
    method: 'GET',
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/agents/sse', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 without tenantId query param', async () => {
    const res = await GET(reqWithoutTenant());
    expect(res.status).toBe(400);
  });

  it('returns SSE response with correct headers', async () => {
    const res = await GET(reqWithTenant());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('returns readable stream body', async () => {
    const res = await GET(reqWithTenant());
    expect(res.body).toBeTruthy();
    expect(res.body).toBeInstanceOf(ReadableStream);
  });
});

describe('broadcastActivity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is a callable function', () => {
    expect(typeof broadcastActivity).toBe('function');
  });

  it('publishes activity event to redis', async () => {
    await broadcastActivity('tenant-1', { type: 'test', id: 'a1' });
    expect(mocks.mockRedisPublish).toHaveBeenCalledWith(
      'sse:tenant-1',
      expect.stringContaining('"event":"activity"'),
    );
  });
});

describe('broadcastApproval', () => {
  it('publishes approval event to redis', async () => {
    await broadcastApproval('tenant-1', { approvalId: 'a1' });
    expect(mocks.mockRedisPublish).toHaveBeenCalledWith(
      'sse:tenant-1',
      expect.stringContaining('"event":"approval"'),
    );
  });
});

describe('broadcastOpportunity', () => {
  it('publishes opportunity event to redis', async () => {
    await broadcastOpportunity('tenant-1', { opportunityId: 'o1' });
    expect(mocks.mockRedisPublish).toHaveBeenCalledWith(
      'sse:tenant-1',
      expect.stringContaining('"event":"opportunity"'),
    );
  });
});
