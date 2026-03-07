import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: vi.fn(),
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/notifications',
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const options: RequestInit = { 
    method,
    headers: {
      'x-user-id': 'user1',
      ...(headers || {}),
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
    (options.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  return new NextRequest(new URL(url), options);
}

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return notifications list for authenticated user', async () => {
    const mockNotifications = [
      {
        id: 'n1',
        tenantId: 'tenant1',
        userId: 'user1',
        type: 'APPROVAL_REQUEST',
        title: 'New Approval',
        message: 'Contract needs approval',
        isRead: false,
        createdAt: new Date(),
      },
    ];

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.notification.findMany).mockResolvedValue(mockNotifications);
    vi.mocked(prisma.notification.count).mockResolvedValue(5);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.notifications).toBeDefined();
  });

  it('should filter notifications by read status', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    const request = createRequest('GET', 'http://localhost:3000/api/notifications?isRead=false');
    await GET(request);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isRead: false }),
      })
    );
  });

  it('should filter notifications by type', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    const request = createRequest('GET', 'http://localhost:3000/api/notifications?type=APPROVAL_REQUEST');
    await GET(request);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'APPROVAL_REQUEST' }),
      })
    );
  });

  it('should handle database errors and return mock data', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.notification.findMany).mockRejectedValue(new Error('Database error'));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    // Should fallback to mock data
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.notifications).toBeDefined();
  });
});

describe('POST /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest('POST', 'http://localhost:3000/api/notifications', {
      userId: 'user1',
      type: 'SYSTEM',
      title: 'Test',
      message: 'Test message',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should create notification successfully', async () => {
    const mockNotification = {
      id: 'n1',
      tenantId: 'tenant1',
      userId: 'user1',
      type: 'SYSTEM',
      title: 'Test Notification',
      message: 'This is a test',
      isRead: false,
      createdAt: new Date(),
    };

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.notification.create).mockResolvedValue(mockNotification);

    const request = createRequest('POST', 'http://localhost:3000/api/notifications', {
      userId: 'user1',
      type: 'SYSTEM',
      title: 'Test Notification',
      message: 'This is a test',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.notification).toBeDefined();
  });
});

describe('PATCH /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest('PATCH', 'http://localhost:3000/api/notifications', {
      ids: ['n1'],
      isRead: true,
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should mark notifications as read', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 3 });

    const request = createRequest('PATCH', 'http://localhost:3000/api/notifications', {
      ids: ['n1', 'n2', 'n3'],
      isRead: true,
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should mark all notifications as read when markAllRead is true', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 10 });

    const request = createRequest('PATCH', 'http://localhost:3000/api/notifications', {
      markAllRead: true,
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
