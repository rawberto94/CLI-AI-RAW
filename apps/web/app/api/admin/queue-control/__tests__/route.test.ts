import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../route';

function createRequest(role: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/queue-control', {
    method: 'POST',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': role,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'pause',
      queueName: 'contract-processing',
    }),
  });
}

describe('Admin Queue Control API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin queue control requests', async () => {
    const response = await POST(createRequest('member'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
  });
});