import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock setup ────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  mockRFxEvent: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  mockContract: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rFxEvent: mocks.mockRFxEvent,
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
                scores: { 'Vendor A': { total: 85, criteria: { Price: 90, Technical: 80 } } },
                rankings: [{ vendorName: 'Vendor A', totalScore: 85, rank: 1 }],
                priceAnalysis: { lowest: 100000, highest: 100000, average: 100000, range: 0 },
                recommendation: { winner: 'Vendor A', confidence: 0.9, justification: 'Best fit', risks: [] },
                suggestions: [{ title: 'Extra Req', description: 'Desc', category: 'security', priority: 'should-have', source: 'ai', rationale: 'Important' }],
                justification: 'Vendor A demonstrated the strongest technical capability.',
                openingPosition: 'Start at $90K',
                keyLevers: ['Volume discount'],
                concessionStrategy: ['Quality tier'],
                walkAwayPrice: 95000,
                counterOffers: [{ scenario: 'Price push', response: 'Counter with value' }],
                estimatedSavings: '10%',
                suggestedTimeline: '2 weeks',
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

import { GET, PATCH } from '../route';

// ── Helpers ───────────────────────────────────────────────────────────
function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: { body?: object }
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

// Route params to pass as second arg (Next.js 15 async params)
const routeContext = { params: Promise.resolve({ id: 'rfx-1' }) };

// ── Sample data ──────────────────────────────────────────────────────
const baseSampleEvent = {
  id: 'rfx-1',
  tenantId: 'test-tenant',
  title: 'IT Services RFP',
  type: 'RFP',
  description: 'Test',
  category: null,
  contractType: null,
  estimatedValue: 100000,
  currency: 'USD',
  publishDate: null,
  responseDeadline: new Date('2026-06-01'),
  awardDate: null,
  contractStartDate: null,
  requirements: [
    { title: 'Req 1', description: 'Desc', category: 'technical', priority: 'must-have', source: 'user' },
  ],
  evaluationCriteria: [
    { name: 'Price', description: 'Cost', weight: 0.5, scoringMethod: 'numeric' },
    { name: 'Technical', description: 'Capability', weight: 0.5, scoringMethod: 'numeric' },
  ],
  invitedVendors: ['Vendor A', 'Vendor B'],
  responses: null,
  winner: null,
  awardJustification: null,
  savingsAchieved: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test-user',
};

function sampleEvent(overrides: Record<string, unknown> = {}) {
  return { ...baseSampleEvent, ...overrides };
}

// ====================================================================
// GET /api/rfx/[id]
// ====================================================================
describe('GET /api/rfx/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns event with vendor profiles and workflow', async () => {
    mocks.mockRFxEvent.findFirst.mockResolvedValue(sampleEvent());
    mocks.mockContract.findMany.mockResolvedValue([
      { id: 'c1', contractTitle: 'Contract 1', totalValue: 50000 },
    ]);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rfx/rfx-1');
    const response = await GET(request, routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.event.id).toBe('rfx-1');
    expect(data.data.workflow).toBeDefined();
    expect(data.data.workflow).toHaveLength(5);
    expect(data.data.vendorProfiles).toHaveLength(2);
  });

  it('returns 404 for non-existent event', async () => {
    mocks.mockRFxEvent.findFirst.mockResolvedValue(null);

    const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/rfx/rfx-999');
    const response = await GET(request, routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('NOT_FOUND');
  });
});

// ====================================================================
// PATCH /api/rfx/[id] — Workflow Actions
// ====================================================================
describe('PATCH /api/rfx/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── publish ──────────────────────────────────────────────────────────
  describe('publish', () => {
    it('transitions draft → published', async () => {
      const event = sampleEvent({ status: 'draft' });
      mocks.mockRFxEvent.findFirst.mockResolvedValue(event);
      mocks.mockRFxEvent.update.mockResolvedValue({ ...event, status: 'published', publishDate: new Date() });

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'publish' },
      });
      const response = await PATCH(request, routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.event.status).toBe('published');
    });

    it('rejects publish on non-draft', async () => {
      mocks.mockRFxEvent.findFirst.mockResolvedValue(sampleEvent({ status: 'open' }));

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'publish' },
      });
      const response = await PATCH(request, routeContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('INVALID_STATE');
    });
  });

  // ── add_bid ──────────────────────────────────────────────────────────
  describe('add_bid', () => {
    it('records a bid on published event', async () => {
      const event = sampleEvent({ status: 'published', responses: [] });
      mocks.mockRFxEvent.findFirst.mockResolvedValue(event);
      mocks.mockRFxEvent.update.mockResolvedValue({
        ...event,
        status: 'open',
        responses: [{ vendorName: 'Vendor A', commercialResponse: { totalPrice: 100000 } }],
      });

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: {
          action: 'add_bid',
          vendorName: 'Vendor A',
          bid: { commercialResponse: { totalPrice: 100000 } },
        },
      });
      const response = await PATCH(request, routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.bidCount).toBe(1);
    });

    it('rejects bid on draft event', async () => {
      mocks.mockRFxEvent.findFirst.mockResolvedValue(sampleEvent({ status: 'draft' }));

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: {
          action: 'add_bid',
          vendorName: 'Vendor A',
          bid: { commercialResponse: { totalPrice: 100000 } },
        },
      });
      const response = await PATCH(request, routeContext);

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INVALID_STATE');
    });

    it('rejects bid on cancelled event', async () => {
      mocks.mockRFxEvent.findFirst.mockResolvedValue(sampleEvent({ status: 'cancelled' }));

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: {
          action: 'add_bid',
          vendorName: 'Vendor A',
          bid: { commercialResponse: { totalPrice: 50000 } },
        },
      });
      const response = await PATCH(request, routeContext);

      expect(response.status).toBe(400);
    });
  });

  // ── evaluate ────────────────────────────────────────────────────────
  describe('evaluate', () => {
    it('evaluates bids on open event with sufficient bids', async () => {
      const event = sampleEvent({
        status: 'open',
        responses: [
          { vendorName: 'Vendor A', commercialResponse: { totalPrice: 100000 } },
          { vendorName: 'Vendor B', commercialResponse: { totalPrice: 120000 } },
        ],
      });
      mocks.mockRFxEvent.findFirst.mockResolvedValue(event);
      mocks.mockRFxEvent.update.mockResolvedValue({ ...event, status: 'closed' });

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'evaluate' },
      });
      const response = await PATCH(request, routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.evaluation).toBeDefined();
      expect(data.data.evaluation.rankings).toBeDefined();
    });

    it('rejects evaluation on draft event', async () => {
      mocks.mockRFxEvent.findFirst.mockResolvedValue(sampleEvent({ status: 'draft' }));

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'evaluate' },
      });
      const response = await PATCH(request, routeContext);

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INVALID_STATE');
    });

    it('rejects evaluation with insufficient bids', async () => {
      const event = sampleEvent({
        status: 'open',
        responses: [{ vendorName: 'Vendor A', commercialResponse: { totalPrice: 100000 } }],
      });
      mocks.mockRFxEvent.findFirst.mockResolvedValue(event);

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'evaluate' },
      });
      const response = await PATCH(request, routeContext);

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INSUFFICIENT_BIDS');
    });
  });

  // ── award ────────────────────────────────────────────────────────────
  describe('award', () => {
    it('awards to winner on closed event', async () => {
      const event = sampleEvent({ status: 'closed' });
      mocks.mockRFxEvent.findFirst.mockResolvedValue(event);
      mocks.mockRFxEvent.update.mockResolvedValue({
        ...event,
        status: 'awarded',
        winner: 'Vendor A',
        awardJustification: 'Strong technical fit',
      });

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'award', winner: 'Vendor A' },
      });
      const response = await PATCH(request, routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.event.status).toBe('awarded');
      expect(data.data.justification).toBeDefined();
    });

    it('rejects award on non-closed event', async () => {
      mocks.mockRFxEvent.findFirst.mockResolvedValue(sampleEvent({ status: 'open' }));

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'award', winner: 'Vendor A' },
      });
      const response = await PATCH(request, routeContext);

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INVALID_STATE');
    });
  });

  // ── negotiate ────────────────────────────────────────────────────────
  describe('negotiate', () => {
    it('returns strategy and event', async () => {
      mocks.mockRFxEvent.findFirst.mockResolvedValue(sampleEvent({ status: 'closed' }));

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'negotiate', vendorName: 'Vendor A', currentBid: 100000, targetPrice: 85000 },
      });
      const response = await PATCH(request, routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.strategy).toBeDefined();
      expect(data.data.event).toBeDefined(); // Bug fix: negotiate now returns event
    });
  });

  // ── cancel ───────────────────────────────────────────────────────────
  describe('cancel', () => {
    it('cancels the event', async () => {
      const event = sampleEvent({ status: 'open' });
      mocks.mockRFxEvent.findFirst.mockResolvedValue(event);
      mocks.mockRFxEvent.update.mockResolvedValue({ ...event, status: 'cancelled' });

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'cancel', reason: 'Budget cut' },
      });
      const response = await PATCH(request, routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.event.status).toBe('cancelled');
    });
  });

  // ── update_requirements ──────────────────────────────────────────────
  describe('update_requirements', () => {
    it('replaces requirements array', async () => {
      const event = sampleEvent();
      const newReqs = [
        { title: 'New Req', description: 'Updated', category: 'security', priority: 'must-have' as const, source: 'user' as const },
      ];
      mocks.mockRFxEvent.findFirst.mockResolvedValue(event);
      mocks.mockRFxEvent.update.mockResolvedValue({ ...event, requirements: newReqs });

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'update_requirements', requirements: newReqs },
      });
      const response = await PATCH(request, routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.event.requirements).toEqual(newReqs);
    });
  });

  // ── ai_enhance_requirements ──────────────────────────────────────────
  describe('ai_enhance_requirements', () => {
    it('returns AI suggestions', async () => {
      mocks.mockRFxEvent.findFirst.mockResolvedValue(sampleEvent());

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/rfx/rfx-1', {
        body: { action: 'ai_enhance_requirements' },
      });
      const response = await PATCH(request, routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.suggestions).toBeDefined();
    });
  });
});
