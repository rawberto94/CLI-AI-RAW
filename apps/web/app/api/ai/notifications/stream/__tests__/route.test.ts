/**
 * Tests for GET /api/ai/notifications/stream
 * Agent notification SSE stream endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockSubscribeToNotifications: vi.fn().mockReturnValue(() => {}),
  mockGetAuthContext: vi.fn(),
}));

vi.mock('@/lib/ai/agent-notifications', () => ({
  subscribeToNotifications: mocks.mockSubscribeToNotifications,
}));

vi.mock('@/lib/api-middleware', () => ({
  getAuthenticatedApiContext: mocks.mockGetAuthContext,
}));

// ── Import route AFTER mocks ──────────────────────────────────────────

import { GET } from '../route';

// ── Helpers ────────────────────────────────────────────────────────────

function authReq() {
  const controller = new AbortController();
  const req = new NextRequest('http://localhost:3000/api/ai/notifications/stream', {
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
  return new NextRequest('http://localhost:3000/api/ai/notifications/stream', {
    method: 'GET',
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/ai/notifications/stream', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    mocks.mockGetAuthContext.mockReturnValue(null);
    const res = await GET(noAuthReq());
    expect(res.status).toBe(401);
  });

  it('returns SSE response with correct headers', async () => {
    mocks.mockGetAuthContext.mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      requestId: 'req-1',
    });

    const res = await GET(authReq());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(res.headers.get('Connection')).toBe('keep-alive');
    expect(res.headers.get('X-Accel-Buffering')).toBe('no');
  });

  it('returns readable stream body', async () => {
    mocks.mockGetAuthContext.mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      requestId: 'req-1',
    });

    const res = await GET(authReq());
    expect(res.body).toBeTruthy();
    expect(res.body).toBeInstanceOf(ReadableStream);
  });

  it('subscribes to notifications for the correct tenant/user', async () => {
    mocks.mockGetAuthContext.mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      requestId: 'req-1',
    });

    const res = await GET(authReq());
    // Reading from the stream triggers the start() callback
    const reader = res.body!.getReader();
    await reader.read(); // read initial heartbeat
    reader.releaseLock();

    expect(mocks.mockSubscribeToNotifications).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      expect.any(Function),
    );
  });
});
