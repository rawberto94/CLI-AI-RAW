/**
 * Tests for GET /api/agents/sse and broadcastSSE
 * Agent HITL Server-Sent Events endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockAgentGoalFindMany: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentGoal: { findMany: mocks.mockAgentGoalFindMany },
  },
}));

vi.mock('@/lib/notifications/hitl-notification.service', () => ({
  sendHITLApprovalNotification: vi.fn().mockResolvedValue(undefined),
}));

// ── Import AFTER mocks ────────────────────────────────────────────────

import { GET, broadcastSSE, getSSESubscriberCount } from '../route';

// ── Helpers ────────────────────────────────────────────────────────────

function authReq() {
  const controller = new AbortController();
  const req = new NextRequest('http://localhost:3000/api/agents/sse', {
    method: 'GET',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
  });
  // jsdom may not propagate signal — patch it for SSE stream handling
  if (!req.signal) {
    Object.defineProperty(req, 'signal', {
      value: controller.signal,
      writable: false,
    });
  }
  return req;
}

function noAuthReq() {
  return new NextRequest('http://localhost:3000/api/agents/sse', {
    method: 'GET',
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/agents/sse', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth headers', async () => {
    const res = await GET(noAuthReq());
    expect(res.status).toBe(401);
  });

  it('returns SSE response with correct headers', async () => {
    const res = await GET(authReq());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(res.headers.get('Connection')).toBe('keep-alive');
    expect(res.headers.get('X-Accel-Buffering')).toBe('no');
  });

  it('returns readable stream body', async () => {
    const res = await GET(authReq());
    expect(res.body).toBeTruthy();
    expect(res.body).toBeInstanceOf(ReadableStream);
  });
});

describe('broadcastSSE', () => {
  it('is a callable function', () => {
    expect(typeof broadcastSSE).toBe('function');
  });

  it('does not throw when no subscribers exist', () => {
    expect(() => {
      broadcastSSE('tenant-1', 'goal_approved', { goalId: 'g1' });
    }).not.toThrow();
  });
});

describe('getSSESubscriberCount', () => {
  it('returns a number', () => {
    const count = getSSESubscriberCount();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
