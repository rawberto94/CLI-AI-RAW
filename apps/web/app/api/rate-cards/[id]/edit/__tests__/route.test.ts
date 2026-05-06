import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockRateCardEntryFindFirst,
  mockRateCardEntryUpdate,
  mockAuditLogCreate,
} = vi.hoisted(() => ({
  mockRateCardEntryFindFirst: vi.fn(),
  mockRateCardEntryUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateCardEntry: {
      findFirst: mockRateCardEntryFindFirst,
      update: mockRateCardEntryUpdate,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
  },
}));

import { PATCH } from '../route';

function createRequest(withAuth = true, body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/rate-cards/rc-1/edit', {
    method: 'PATCH',
    headers: withAuth
      ? {
          'x-user-id': 'real-user',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'rc-1' }),
};

describe('/api/rate-cards/[id]/edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const response = await PATCH(createRequest(false, { dailyRate: 1200 }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('ignores forged editedBy values and uses ctx.userId for edit attribution', async () => {
    mockRateCardEntryFindFirst.mockResolvedValue({
      id: 'rc-1',
      tenantId: 'tenant-1',
      isEditable: true,
      clientName: 'Acme',
      isBaseline: false,
      isNegotiated: false,
      dailyRate: 1000,
      editHistory: [],
    });
    mockRateCardEntryUpdate.mockResolvedValue({ id: 'rc-1', editedBy: 'real-user' });
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-1' });

    const response = await PATCH(
      createRequest(true, {
        dailyRate: 1200,
        editedBy: 'forged-user',
      }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRateCardEntryUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'rc-1' },
      data: expect.objectContaining({
        dailyRate: 1200,
        editedBy: 'real-user',
        editHistory: [
          expect.objectContaining({
            editedBy: 'real-user',
          }),
        ],
      }),
    }));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'real-user',
      }),
    }));
  });
});