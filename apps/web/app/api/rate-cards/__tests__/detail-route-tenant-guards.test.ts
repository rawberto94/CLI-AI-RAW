import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockRateCardFindFirst,
  mockCalculateQualityScore,
  mockSuggestTargetRates,
  mockFindAlternatives,
  mockGenerateEnhancedTalkingPoints,
  mockGenerateScenarios,
} = vi.hoisted(() => ({
  mockRateCardFindFirst: vi.fn(),
  mockCalculateQualityScore: vi.fn(),
  mockSuggestTargetRates: vi.fn(),
  mockFindAlternatives: vi.fn(),
  mockGenerateEnhancedTalkingPoints: vi.fn(),
  mockGenerateScenarios: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateCardEntry: {
      findFirst: mockRateCardFindFirst,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  dataQualityScorerService: class {
    calculateQualityScore = mockCalculateQualityScore;
  },
  negotiationAssistantService: class {
    suggestTargetRates = mockSuggestTargetRates;
    findAlternatives = mockFindAlternatives;
  },
  negotiationAssistantEnhancedService: {
    generateEnhancedTalkingPoints: mockGenerateEnhancedTalkingPoints,
  },
  negotiationScenarioService: {
    generateScenarios: mockGenerateScenarios,
  },
}));

import { GET as getQuality } from '../[id]/quality/route';
import { GET as getTargetRates } from '../[id]/target-rates/route';
import { GET as getAlternatives } from '../[id]/alternatives/route';
import { GET as getTalkingPoints } from '../[id]/talking-points/route';
import { GET as getNegotiationScenarios } from '../[id]/negotiation/scenarios/route';

function createRequest(path: string, withAuth = true): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  });
}

describe('rate-card detail route tenant guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/rate-cards/[id]/quality', () => {
    const routeContext = { params: Promise.resolve({ id: 'rc-1' }) };

    it('returns 404 when the rate card is outside the tenant', async () => {
      mockRateCardFindFirst.mockResolvedValue(null);

      const response = await getQuality(createRequest('/api/rate-cards/rc-1/quality'), routeContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(mockCalculateQualityScore).not.toHaveBeenCalled();
    });

    it('calculates quality for a tenant-owned rate card', async () => {
      mockRateCardFindFirst.mockResolvedValue({ id: 'rc-1' });
      mockCalculateQualityScore.mockResolvedValue({ score: 87 });

      const response = await getQuality(createRequest('/api/rate-cards/rc-1/quality'), routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCalculateQualityScore).toHaveBeenCalledWith('rc-1');
    });
  });

  describe('/api/rate-cards/[id]/target-rates', () => {
    const routeContext = { params: Promise.resolve({ id: 'rc-1' }) };

    it('returns 404 when the rate card is outside the tenant', async () => {
      mockRateCardFindFirst.mockResolvedValue(null);

      const response = await getTargetRates(createRequest('/api/rate-cards/rc-1/target-rates'), routeContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(mockSuggestTargetRates).not.toHaveBeenCalled();
    });

    it('suggests target rates for a tenant-owned rate card', async () => {
      mockRateCardFindFirst.mockResolvedValue({ id: 'rc-1' });
      mockSuggestTargetRates.mockResolvedValue({ targetRate: 950 });

      const response = await getTargetRates(createRequest('/api/rate-cards/rc-1/target-rates'), routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSuggestTargetRates).toHaveBeenCalledWith('rc-1');
    });
  });

  describe('/api/rate-cards/[id]/alternatives', () => {
    const routeContext = { params: Promise.resolve({ id: 'rc-1' }) };

    it('returns 404 when the rate card is outside the tenant', async () => {
      mockRateCardFindFirst.mockResolvedValue(null);

      const response = await getAlternatives(createRequest('/api/rate-cards/rc-1/alternatives'), routeContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(mockFindAlternatives).not.toHaveBeenCalled();
    });

    it('finds alternatives for a tenant-owned rate card', async () => {
      mockRateCardFindFirst.mockResolvedValue({ id: 'rc-1' });
      mockFindAlternatives.mockResolvedValue([{ supplierId: 'supplier-2' }]);

      const response = await getAlternatives(createRequest('/api/rate-cards/rc-1/alternatives'), routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockFindAlternatives).toHaveBeenCalledWith('rc-1');
    });
  });

  describe('/api/rate-cards/[id]/talking-points', () => {
    const routeContext = { params: Promise.resolve({ id: 'rc-1' }) };

    it('returns 404 when the rate card is outside the tenant', async () => {
      mockRateCardFindFirst.mockResolvedValue(null);

      const response = await getTalkingPoints(createRequest('/api/rate-cards/rc-1/talking-points'), routeContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(mockGenerateEnhancedTalkingPoints).not.toHaveBeenCalled();
    });

    it('generates talking points for a tenant-owned rate card', async () => {
      mockRateCardFindFirst.mockResolvedValue({ id: 'rc-1' });
      mockGenerateEnhancedTalkingPoints.mockResolvedValue(['Push on blended rates']);

      const response = await getTalkingPoints(createRequest('/api/rate-cards/rc-1/talking-points'), routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockGenerateEnhancedTalkingPoints).toHaveBeenCalledWith('rc-1', 'tenant-1');
    });
  });

  describe('/api/rate-cards/[id]/negotiation/scenarios', () => {
    const routeContext = { params: Promise.resolve({ id: 'rc-1' }) };

    it('returns 404 when the rate card is outside the tenant', async () => {
      mockRateCardFindFirst.mockResolvedValue(null);

      const response = await getNegotiationScenarios(
        createRequest('/api/rate-cards/rc-1/negotiation/scenarios?volume=20'),
        routeContext,
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(mockGenerateScenarios).not.toHaveBeenCalled();
    });

    it('generates scenarios for a tenant-owned rate card', async () => {
      mockRateCardFindFirst.mockResolvedValue({ id: 'rc-1' });
      mockGenerateScenarios.mockResolvedValue([{ name: 'Volume discount' }]);

      const response = await getNegotiationScenarios(
        createRequest('/api/rate-cards/rc-1/negotiation/scenarios?volume=20'),
        routeContext,
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockGenerateScenarios).toHaveBeenCalledWith('rc-1', 'tenant-1', 20);
    });
  });
});