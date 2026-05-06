import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGenerateSmartComparison } = vi.hoisted(() => ({
  mockGenerateSmartComparison: vi.fn(),
}));

vi.mock('@/lib/ai/smart-comparison.service', () => ({
  generateSmartComparison: mockGenerateSmartComparison,
}));

import { POST } from '../route';

function createRequest(withAuth = true, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/smart-compare', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/smart-compare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateSmartComparison.mockResolvedValue({ summary: 'AI comparison' });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false, {
      contractId1: 'contract-1',
      contractId2: 'contract-2',
    }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects comparing a contract with itself', async () => {
    const response = await POST(createRequest(true, {
      contractId1: 'contract-1',
      contractId2: 'contract-1',
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('forwards authenticated tenant context into smart comparison generation', async () => {
    const response = await POST(createRequest(true, {
      contractId1: 'contract-1',
      contractId2: 'contract-2',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGenerateSmartComparison).toHaveBeenCalledWith({
      contractId1: 'contract-1',
      contractId2: 'contract-2',
      tenantId: 'tenant-1',
    });
    expect(data.data.report.summary).toBe('AI comparison');
  });
});