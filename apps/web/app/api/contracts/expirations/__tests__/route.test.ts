import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockQueryRaw,
  mockExecuteRaw,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
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

describe('/api/contracts/expirations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters GET queries by the authenticated tenant', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          total: BigInt(0),
          expired: BigInt(0),
          critical: BigInt(0),
          high: BigInt(0),
          medium: BigInt(0),
          low: BigInt(0),
          pending: BigInt(0),
          initiated: BigInt(0),
          completed: BigInt(0),
          total_value_at_risk: 0,
          avg_days_to_expiry: 0,
        },
      ]);

    const response = await GET(authRequest('http://localhost:3000/api/contracts/expirations', 'GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(JSON.stringify(mockQueryRaw.mock.calls[0])).toContain('tenant-auth');
  });

  it('records notice with the authenticated user instead of trusting body userId', async () => {
    mockExecuteRaw.mockResolvedValue(1);

    const response = await POST(
      authRequest('http://localhost:3000/api/contracts/expirations', 'POST', {
        action: 'give-notice',
        contractId: 'contract-1',
        data: { userId: 'forged-user' },
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