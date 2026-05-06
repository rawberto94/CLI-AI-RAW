import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockContractFindMany,
  mockContractFindFirst,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockContractFindFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    contract: {
      findMany: mockContractFindMany,
      findFirst: mockContractFindFirst,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { GET, POST } from '../route';

function authRequest(url: string, method: 'GET' | 'POST', body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: {
      'x-user-id': 'user-auth',
      'x-tenant-id': 'tenant-auth',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters GET queries by the authenticated tenant', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          id: 'alert-1',
          contract_id: 'contract-1',
          alert_type: 'EXPIRATION_30_DAYS',
          severity: 'HIGH',
          title: 'Alert',
          message: 'Expires soon',
          recipients: [],
          sent_to: [],
          status: 'PENDING',
          sent_at: null,
          delivered_at: null,
          acknowledged_by: null,
          acknowledged_at: null,
          acknowledged_action: null,
          snooze_until: null,
          scheduled_for: new Date('2026-04-28T12:00:00.000Z'),
          days_before_expiry: 30,
          metadata: {},
          created_at: new Date('2026-04-28T12:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          total: BigInt(1),
          pending: BigInt(1),
          sent: BigInt(0),
          acknowledged: BigInt(0),
          critical: BigInt(0),
          high: BigInt(1),
          medium: BigInt(0),
          low: BigInt(0),
          overdue: BigInt(0),
        },
      ]);
    mockContractFindMany.mockResolvedValue([
      {
        id: 'contract-1',
        contractTitle: 'Master Services Agreement',
        originalName: null,
        supplierName: 'Supplier Inc',
        expirationDate: new Date('2026-05-28T12:00:00.000Z'),
        endDate: null,
      },
    ]);

    const response = await GET(authRequest('http://localhost:3000/api/contracts/alerts', 'GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalled();
    expect(JSON.stringify(mockQueryRaw.mock.calls[0])).toContain('tenant-auth');
  });

  it('creates alerts only for contracts owned by the authenticated tenant', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockExecuteRaw.mockResolvedValue(1);

    const response = await POST(
      authRequest('http://localhost:3000/api/contracts/alerts', 'POST', {
        action: 'create',
        contractId: 'contract-1',
        data: { alertType: 'EXPIRATION_30_DAYS' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockContractFindFirst).toHaveBeenCalledWith({
      where: { id: 'contract-1', tenantId: 'tenant-auth' },
      select: { id: true },
    });
    expect(mockExecuteRaw.mock.calls[0].slice(1)).toContain('tenant-auth');
  });

  it('records the authenticated user on acknowledge instead of trusting body userId', async () => {
    mockExecuteRaw.mockResolvedValue(1);

    const response = await POST(
      authRequest('http://localhost:3000/api/contracts/alerts', 'POST', {
        action: 'acknowledge',
        alertId: 'alert-1',
        data: { userId: 'forged-user', action: 'DISMISS' },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    const executeValues = mockExecuteRaw.mock.calls[0].slice(1);
    expect(executeValues).toContain('user-auth');
    expect(executeValues).not.toContain('forged-user');
    expect(executeValues).toContain('tenant-auth');
  });
});