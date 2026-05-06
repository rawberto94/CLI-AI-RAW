import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockUserFindFirst,
  mockCreateNotificationWithPush,
  mockNotifyByRole,
} = vi.hoisted(() => ({
  mockUserFindFirst: vi.fn(),
  mockCreateNotificationWithPush: vi.fn(),
  mockNotifyByRole: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mockUserFindFirst,
    },
  },
}));

vi.mock('@/lib/push-notification.service', () => ({
  createNotificationWithPush: mockCreateNotificationWithPush,
  notifyByRole: mockNotifyByRole,
}));

import { POST } from '../route';

function createAuthenticatedRequest(
  role: string,
  body: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/notifications/send', {
    method: 'POST',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'x-user-role': role,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/notifications/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', message: 'Hello', userId: 'user-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 for non-admin users', async () => {
    const response = await POST(createAuthenticatedRequest('member', {
      title: 'Test',
      message: 'Hello',
      userId: 'user-1',
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
  });

  it('sends role notifications for admins', async () => {
    mockNotifyByRole.mockResolvedValue({ sent: 2 });

    const response = await POST(createAuthenticatedRequest('admin', {
      action: 'notify-role',
      role: 'legal',
      title: 'Test',
      message: 'Hello',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockNotifyByRole).toHaveBeenCalledWith('test-tenant', 'legal', expect.objectContaining({
      title: 'Test',
      message: 'Hello',
    }));
  });

  it('returns 404 when direct target user is not in tenant', async () => {
    mockUserFindFirst.mockResolvedValue(null);

    const response = await POST(createAuthenticatedRequest('admin', {
      title: 'Test',
      message: 'Hello',
      userId: 'user-1',
    }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });
});