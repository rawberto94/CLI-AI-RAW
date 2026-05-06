import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockRateCardEntryFindFirst,
  mockGenerateNegotiationBrief,
} = vi.hoisted(() => ({
  mockRateCardEntryFindFirst: vi.fn(),
  mockGenerateNegotiationBrief: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateCardEntry: {
      findFirst: mockRateCardEntryFindFirst,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  negotiationAssistantService: vi.fn().mockImplementation(() => ({
    generateNegotiationBrief: mockGenerateNegotiationBrief,
  })),
}));

import { GET } from '../route';

function createRequest(withAuth = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/rate-cards/rc-1/negotiation-brief', {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'x-user-role': 'member',
        }
      : undefined,
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'rc-1' }),
};

describe('GET /api/rate-cards/[id]/negotiation-brief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest(false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the rate card is not in the tenant', async () => {
    mockRateCardEntryFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockGenerateNegotiationBrief).not.toHaveBeenCalled();
  });

  it('returns the negotiation brief for a tenant-owned rate card', async () => {
    mockRateCardEntryFindFirst.mockResolvedValue({ id: 'rc-1' });
    mockGenerateNegotiationBrief.mockResolvedValue({
      currentSituation: {
        supplierName: 'Acme Consulting',
      },
    });

    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGenerateNegotiationBrief).toHaveBeenCalledWith('rc-1');
    expect(data.data.data.currentSituation.supplierName).toBe('Acme Consulting');
  });
});