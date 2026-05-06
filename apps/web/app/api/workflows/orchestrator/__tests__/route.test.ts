import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workflowExecution: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    workflowStepExecution: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    agentGoal: {
      count: vi.fn(),
    },
    contract: {
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

import { GET } from '../route';

function createRequest(role?: string, action = 'triggers'): NextRequest {
  return new NextRequest(`http://localhost:3000/api/workflows/orchestrator?action=${action}`, {
    method: 'GET',
    headers: role
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': role,
        }
      : undefined,
  });
}

describe('GET /api/workflows/orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(undefined));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 for non-admin users', async () => {
    const response = await GET(createRequest('member'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
  });

  it('returns trigger metadata for admins', async () => {
    const response = await GET(createRequest('admin'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.triggers).toHaveLength(3);
    expect(data.data.data.triggers[0]).toEqual(expect.objectContaining({
      id: 'workflow-escalation-check',
      enabled: true,
    }));
  });
});