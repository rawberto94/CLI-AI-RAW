/**
 * Tests for GET/POST /api/ai/notifications
 * Agent notification CRUD API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockGetNotifications: vi.fn(),
  mockGetUnreadCount: vi.fn(),
  mockMarkNotificationRead: vi.fn(),
  mockMarkAllRead: vi.fn(),
}));

vi.mock('@/lib/ai/agent-notifications', () => ({
  getNotifications: mocks.mockGetNotifications,
  getUnreadCount: mocks.mockGetUnreadCount,
  markNotificationRead: mocks.mockMarkNotificationRead,
  markAllRead: mocks.mockMarkAllRead,
}));

vi.mock('@/lib/ai/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  rateLimitResponse: vi.fn(),
  AI_RATE_LIMITS: { lightweight: { windowMs: 60000, max: 100 } },
}));

// ── Import routes AFTER mocks ──────────────────────────────────────────

import { GET, POST } from '../route';

// ── Helpers ────────────────────────────────────────────────────────────

function authGet(url: string) {
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
  });
}

function authPost(url: string, body: Record<string, unknown>) {
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

function noAuthReq(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

const BASE = 'http://localhost:3000/api/ai/notifications';

// ── GET Tests ──────────────────────────────────────────────────────────

describe('GET /api/ai/notifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE));
    expect(res.status).toBe(401);
  });

  it('returns notifications', async () => {
    const notifications = [
      { id: 'n1', title: 'Risk alert', message: 'High risk', read: false },
      { id: 'n2', title: 'Deadline', message: 'Approaching', read: true },
    ];
    mocks.mockGetNotifications.mockResolvedValue(notifications);
    mocks.mockGetUnreadCount.mockResolvedValue(1);

    const res = await GET(authGet(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notifications).toHaveLength(2);
    expect(json.unreadCount).toBe(1);
  });

  it('passes filter params to getNotifications', async () => {
    mocks.mockGetNotifications.mockResolvedValue([]);
    mocks.mockGetUnreadCount.mockResolvedValue(0);

    await GET(authGet(`${BASE}?unread=true&limit=5&types=risk_alert,deadline&severities=critical`));

    expect(mocks.mockGetNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        unreadOnly: true,
        limit: 5,
        types: ['risk_alert', 'deadline'],
        severities: ['critical'],
      }),
    );
  });

  it('caps limit at 50', async () => {
    mocks.mockGetNotifications.mockResolvedValue([]);
    mocks.mockGetUnreadCount.mockResolvedValue(0);

    await GET(authGet(`${BASE}?limit=500`));

    expect(mocks.mockGetNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });
});

// ── POST Tests ─────────────────────────────────────────────────────────

describe('POST /api/ai/notifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await POST(
      new NextRequest(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('marks all notifications read', async () => {
    mocks.mockMarkAllRead.mockResolvedValue(5);

    const res = await POST(authPost(BASE, { markAllRead: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.markedRead).toBe(5);
    expect(mocks.mockMarkAllRead).toHaveBeenCalledWith('tenant-1', 'user-1');
  });

  it('marks single notification read', async () => {
    mocks.mockMarkNotificationRead.mockResolvedValue(true);

    const res = await POST(authPost(BASE, { notificationId: 'n1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mocks.mockMarkNotificationRead).toHaveBeenCalledWith('tenant-1', 'n1');
  });

  it('returns 400 without required params', async () => {
    const res = await POST(authPost(BASE, {}));
    expect(res.status).toBe(400);
  });
});
