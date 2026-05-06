import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGenerateAndStorePlaybook } = vi.hoisted(() => ({
  mockGenerateAndStorePlaybook: vi.fn(),
}));

vi.mock('@/lib/ai/negotiation-copilot.service', () => ({
  generateAndStorePlaybook: mockGenerateAndStorePlaybook,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {},
    artifact: {},
    auditLog: {},
  },
}));

import { POST } from '../route';

function createRequest(withAuth = true, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/negotiate', {
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

describe('/api/contracts/negotiate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAndStorePlaybook.mockResolvedValue({
      summary: 'Playbook',
      overallPosition: 'balanced',
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false, { contractId: 'contract-1' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('forwards authenticated tenant context into playbook generation', async () => {
    const response = await POST(createRequest(true, {
      contractId: 'contract-1',
      ourRole: 'buyer',
      negotiationContext: 'Focus on liability cap',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGenerateAndStorePlaybook).toHaveBeenCalledWith({
      contractId: 'contract-1',
      tenantId: 'tenant-1',
      ourRole: 'buyer',
      negotiationContext: 'Focus on liability cap',
    });
    expect(data.data.playbook.summary).toBe('Playbook');
  });

  it('returns validation errors for invalid requests', async () => {
    const response = await POST(createRequest(true, {}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});