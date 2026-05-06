import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindMany, mockCount, mockCreateMany, mockUpdateMany,
  mockUserFindMany,
  mockGetServerSession, mockPublishRealtimeEvent, mockGetRecent, mockGetUnreadCount,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockCreateMany: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockUserFindMany: vi.fn(),
  mockGetServerSession: vi.fn(),
  mockPublishRealtimeEvent: vi.fn(),
  mockGetRecent: vi.fn(),
  mockGetUnreadCount: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: mockFindMany,
      count: mockCount,
      createMany: mockCreateMany,
      updateMany: mockUpdateMany,
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findMany: mockUserFindMany,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock('@/lib/realtime/publish', () => ({
  publishRealtimeEvent: mockPublishRealtimeEvent,
}));

vi.mock('data-orchestration/services', () => ({
  notificationService: {},
}));

vi.mock('@/lib/notifications/notification-engine', () => ({
  notificationBuffer: {
    getRecent: mockGetRecent,
    getUnreadCount: mockGetUnreadCount,
  },
}));

import { GET, POST, PATCH } from '../route';

function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: { body?: object; searchParams?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url);
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
  }
  return new NextRequest(fullUrl.toString(), {
    method,
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

function createUnauthenticatedRequest(method: string, url: string): NextRequest {
  return new NextRequest(url, { method });
}

beforeEach(() => {
  mockGetServerSession.mockResolvedValue({
    user: { id: 'test-user-id', tenantId: 'test-tenant', email: 'test@example.com' },
  });
  mockPublishRealtimeEvent.mockResolvedValue(undefined);
  mockGetRecent.mockReturnValue([]);
  mockGetUnreadCount.mockReturnValue(0);
});

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', tenantId: 'test-tenant', email: 'test@example.com' },
    });
    mockPublishRealtimeEvent.mockResolvedValue(undefined);
    mockGetRecent.mockReturnValue([]);
    mockGetUnreadCount.mockReturnValue(0);
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/notifications');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns notifications list', async () => {
    const notifications = [
      { id: 'n1', type: 'SYSTEM', title: 'Test', message: 'Test msg', isRead: false, createdAt: new Date() },
    ];
    mockFindMany.mockResolvedValue(notifications);
    mockCount.mockResolvedValue(1);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/notifications');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.notifications).toHaveLength(1);
    expect(data.data.unreadCount).toBe(1);
    expect(data.data.source).toBe('database');
  });

  it('filters unread notifications', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/notifications', {
      searchParams: { unread: 'true' },
    });
    await GET(request);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isRead: false }),
      })
    );
  });

  it('returns empty list when no notifications', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/notifications');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.notifications).toEqual([]);
    expect(data.data.total).toBe(0);
  });
});

describe('POST /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', tenantId: 'test-tenant', email: 'test@example.com' },
    });
    mockPublishRealtimeEvent.mockResolvedValue(undefined);
    mockGetRecent.mockReturnValue([]);
    mockGetUnreadCount.mockReturnValue(0);
  });

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/notifications');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('creates notification', async () => {
    mockUserFindMany.mockResolvedValue([{ id: 'user-1' }]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/notifications', {
      body: {
        userId: 'user-1',
        title: 'New notification',
        message: 'Something happened',
        type: 'SYSTEM',
      },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.count).toBe(1);
  });

  it('returns 404 when a recipient is outside the tenant', async () => {
    mockUserFindMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/notifications', {
      body: {
        userId: 'user-1',
        title: 'New notification',
        message: 'Something happened',
      },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when title missing', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/notifications', {
      body: { message: 'test' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when no recipients', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/notifications', {
      body: { title: 'Test', message: 'Msg' },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id', tenantId: 'test-tenant', email: 'test@example.com' },
    });
    mockPublishRealtimeEvent.mockResolvedValue(undefined);
  });

  it('marks all as read', async () => {
    mockUpdateMany.mockResolvedValue({ count: 3 });

    const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/notifications', {
      body: { markAllRead: true },
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.count).toBe(3);
  });

  it('marks specific notifications as read', async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 });

    const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/notifications', {
      body: { notificationIds: ['n1', 'n2'] },
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.count).toBe(2);
  });
});
