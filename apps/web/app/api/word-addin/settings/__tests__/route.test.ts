import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockCtx,
  mockUserPreferencesFindFirst,
  mockUserPreferencesCreate,
  mockUserPreferencesUpdate,
} = vi.hoisted(() => ({
  mockCtx: {
    requestId: 'req-word-settings',
    tenantId: 'tenant-1',
    userId: undefined as string | undefined,
    startTime: 0,
    dataMode: 'real' as const,
  },
  mockUserPreferencesFindFirst: vi.fn(),
  mockUserPreferencesCreate: vi.fn(),
  mockUserPreferencesUpdate: vi.fn(),
}));

vi.mock('@/lib/api-middleware', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-middleware')>('@/lib/api-middleware');

  return {
    ...actual,
    withAuthApiHandler: (handler: (request: NextRequest, context: any) => Promise<Response>) => {
      return (request: NextRequest) => handler(request, mockCtx);
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userPreferences: {
      findFirst: mockUserPreferencesFindFirst,
      create: mockUserPreferencesCreate,
      update: mockUserPreferencesUpdate,
    },
  },
}));

import { GET, POST } from '../route';

describe('/api/word-addin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.userId = undefined;
  });

  it('returns 401 on GET when userId is missing from auth context', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/word-addin/settings'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockUserPreferencesFindFirst).not.toHaveBeenCalled();
  });

  it('returns 401 on POST when userId is missing from auth context', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/word-addin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark', autoSave: true }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(mockUserPreferencesFindFirst).not.toHaveBeenCalled();
    expect(mockUserPreferencesCreate).not.toHaveBeenCalled();
    expect(mockUserPreferencesUpdate).not.toHaveBeenCalled();
  });
});