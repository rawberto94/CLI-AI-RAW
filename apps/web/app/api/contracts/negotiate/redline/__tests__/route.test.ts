import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGenerateRedlineSuggestion } = vi.hoisted(() => ({
  mockGenerateRedlineSuggestion: vi.fn(),
}));

vi.mock('@/lib/ai/negotiation-copilot.service', () => ({
  generateRedlineSuggestion: mockGenerateRedlineSuggestion,
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
  return new NextRequest('http://localhost:3000/api/contracts/negotiate/redline', {
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

describe('/api/contracts/negotiate/redline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateRedlineSuggestion.mockResolvedValue({
      replacementText: 'Revised clause',
      rationale: 'Improves buyer protection',
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest(false, { clauseText: 'original clause' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('forwards ctx.tenantId into redline generation', async () => {
    const response = await POST(createRequest(true, {
      clauseText: 'The supplier may change prices at any time.',
      clauseType: 'pricing',
      contractType: 'MSA',
      objective: 'Require notice and caps',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGenerateRedlineSuggestion).toHaveBeenCalledWith({
      clauseText: 'The supplier may change prices at any time.',
      clauseType: 'pricing',
      contractType: 'MSA',
      tenantId: 'tenant-1',
      objective: 'Require notice and caps',
    });
    expect(data.data.redline.replacementText).toBe('Revised clause');
  });

  it('returns validation errors for invalid requests', async () => {
    const response = await POST(createRequest(true, {}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});