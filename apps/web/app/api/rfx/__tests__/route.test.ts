import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock setup ────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  mockRFxEvent: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  mockRFxOpportunity: {
    update: vi.fn(),
  },
  mockContract: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rFxEvent: mocks.mockRFxEvent,
    rFxOpportunity: mocks.mockRFxOpportunity,
    contract: mocks.mockContract,
  },
}));

vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                requirements: [
                  { title: 'AI Req 1', description: 'Desc', category: 'technical', priority: 'must-have' },
                  { title: 'AI Req 2', description: 'Desc', category: 'commercial', priority: 'should-have' },
                ],
                evaluationCriteria: [
                  { name: 'Technical', description: 'Technical fit', weight: 0.5, scoringMethod: 'numeric' },
                  { name: 'Price', description: 'Cost', weight: 0.5, scoringMethod: 'numeric' },
                ],
              }),
            },
          }],
        }),
      },
    };
  },
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { GET, POST } from '../route';

// ── Helpers ───────────────────────────────────────────────────────────
function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: { body?: object; searchParams?: Record<string, string> }
): NextRequest {
  const fullUrl = new URL(url);
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
  }
  return new NextRequest(fullUrl.toString(), {
    method,
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

function createUnauthenticatedRequest(method: string, url: string): NextRequest {
  return new NextRequest(url, { method });
}

// ── Sample data ──────────────────────────────────────────────────────
const sampleEvent = {
  id: 'rfx-1',
  tenantId: 'test-tenant',
  title: 'IT Infrastructure Services',
  type: 'RFP',
  status: 'draft',
  description: 'Test description',
  responseDeadline: new Date('2026-06-01'),
  requirements: [{ title: 'Req 1', source: 'user', category: 'general', priority: 'must-have' }],
  evaluationCriteria: [],
  invitedVendors: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user-id',
};

// ====================================================================
// GET /api/rfx
// ====================================================================
describe('GET /api/rfx', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/rfx');
    const response = await GET(request);
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('returns paginated events for authenticated tenant', async () => {
    mocks.mockRFxEvent.findMany.mockResolvedValue([sampleEvent]);
    mocks.mockRFxEvent.count.mockResolvedValue(1);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rfx');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.events).toHaveLength(1);
    expect(data.data.total).toBe(1);
    expect(data.data.hasMore).toBe(false);
  });

  it('filters by status', async () => {
    mocks.mockRFxEvent.findMany.mockResolvedValue([]);
    mocks.mockRFxEvent.count.mockResolvedValue(0);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rfx', {
      searchParams: { status: 'open' },
    });
    await GET(request);

    expect(mocks.mockRFxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'open', tenantId: 'test-tenant' }),
      })
    );
  });

  it('respects pagination params', async () => {
    mocks.mockRFxEvent.findMany.mockResolvedValue([]);
    mocks.mockRFxEvent.count.mockResolvedValue(50);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rfx', {
      searchParams: { page: '2', limit: '10' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.page).toBe(2);
    expect(data.data.limit).toBe(10);
    expect(data.data.hasMore).toBe(true);
    expect(mocks.mockRFxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });
});

// ====================================================================
// POST /api/rfx
// ====================================================================
describe('POST /api/rfx', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without auth headers', async () => {
    const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/rfx');
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('creates a draft RFx with AI-enhanced requirements', async () => {
    mocks.mockRFxEvent.create.mockResolvedValue({
      ...sampleEvent,
      requirements: [
        { title: 'User Req', source: 'user', category: 'general', priority: 'must-have', description: '' },
        { title: 'AI Req 1', source: 'ai', category: 'technical', priority: 'must-have', description: 'Desc' },
        { title: 'AI Req 2', source: 'ai', category: 'commercial', priority: 'should-have', description: 'Desc' },
      ],
    });
    mocks.mockContract.findMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/rfx', {
      body: {
        title: 'IT Infrastructure Services',
        type: 'RFP',
        description: 'Test description',
        aiEnhance: true,
        userRequirements: [{ title: 'User Req' }],
        requirementCategories: ['technical'],
      },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.rfxEvent).toBeDefined();
    expect(data.data.aiEnhanced).toBe(true);
    expect(data.data.requirementsSummary.userProvided).toBe(1);
    expect(data.data.requirementsSummary.aiGenerated).toBe(2);
  });

  it('creates RFx without AI enhancement', async () => {
    mocks.mockRFxEvent.create.mockResolvedValue({
      ...sampleEvent,
      requirements: [{ title: 'Only User Req', source: 'user', category: 'general', priority: 'should-have', description: '' }],
    });
    mocks.mockContract.findMany.mockResolvedValue([]);

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/rfx', {
      body: {
        title: 'Simple RFQ',
        type: 'RFQ',
        aiEnhance: false,
        userRequirements: [{ title: 'Only User Req' }],
      },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.aiEnhanced).toBe(false);
    expect(data.data.requirementsSummary.aiGenerated).toBe(0);
  });

  it('rejects invalid title (too short)', async () => {
    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/rfx', {
      body: {
        title: 'ab',
        type: 'RFP',
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(400); // Zod validation returns 400
  });

  it('links source opportunity when provided', async () => {
    mocks.mockRFxEvent.create.mockResolvedValue(sampleEvent);
    mocks.mockContract.findMany.mockResolvedValue([]);
    mocks.mockRFxOpportunity.update.mockResolvedValue({});

    const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/rfx', {
      body: {
        title: 'From Opportunity',
        type: 'RFP',
        aiEnhance: false,
        sourceOpportunityId: 'opp-123',
      },
    });
    await POST(request);

    expect(mocks.mockRFxOpportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'opp-123' },
        data: expect.objectContaining({ status: 'IMPLEMENTED', rfxId: expect.any(String) }),
      })
    );
  });
});
