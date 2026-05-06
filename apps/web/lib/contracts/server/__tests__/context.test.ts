import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}));

import {
  withContractApiHandler,
  withContractSessionApiHandler,
} from '../context';

describe('contract server context wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  it('uses header-auth context only for normal contract routes', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withContractApiHandler(handler);
    const response = await wrapped(new NextRequest('http://localhost:3000/api/contracts/1', {
      headers: {
        'x-user-id': 'user-1',
        'x-tenant-id': 'tenant-1',
      },
    }));

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('rejects normal contract routes when the tenant header is missing', async () => {
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withContractApiHandler(handler);
    const response = await wrapped(new NextRequest('http://localhost:3000/api/contracts/1', {
      headers: {
        'x-user-id': 'user-1',
      },
    }));

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps session fallback opt-in for explicit exception routes', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        role: 'admin',
      },
    });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withContractSessionApiHandler(handler);
    const response = await wrapped(new NextRequest('http://localhost:3000/api/contracts/1/download', {
    }));

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});